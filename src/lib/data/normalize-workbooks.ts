import * as XLSX from 'xlsx';
import { PokerNight, Player, PlayerResult, NightType, ValidationIssue } from '@/types/poker';
import { canonicalPlayerId } from './player-aliases';
import { loadWorkbooks } from './load-workbooks';
import { nightSchema, playerSchema, resultSchema } from './validate-data';

function cellValue(cell: XLSX.CellObject | undefined): unknown {
  if (!cell) return null;
  if (cell.v != null && cell.v !== '') return cell.v;
  if (cell.w != null && cell.w !== '') return cell.w;
  return null;
}

function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  return Array.from({ length: range.e.r - range.s.r + 1 }, (_, rowOffset) => {
    const row = range.s.r + rowOffset;
    return Array.from({ length: range.e.c - range.s.c + 1 }, (_, columnOffset) => {
      const column = range.s.c + columnOffset;
      return cellValue(sheet[XLSX.utils.encode_cell({ r: row, c: column })]);
    });
  });
}

function text(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function money(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = text(v);
  if (s === '?' || /^#/.test(s)) return null;
  const neg = s.includes('(') || s.startsWith('-');
  const n = Number(s.replace(/[,$()%\s]/g, '').replace(/^-/, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

function dateFrom(v: unknown, season: string): string | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(+v)) return v.toISOString().slice(0, 10);
  const s = text(v).replace(/(\d)(st|nd|rd|th)/gi, '$1').trim();
  if (!/\d/.test(s)) return null;
  const seasonYear = season.match(/(\d{4})$/)?.[1];
  const d = new Date(/\b\d{4}\b/.test(s) ? s : `${s} ${seasonYear ?? ''}`);
  if (!Number.isNaN(+d)) return d.toISOString().slice(0, 10);
  const d2 = new Date(s);
  return Number.isNaN(+d2) ? null : d2.toISOString().slice(0, 10);
}

function sheetType(name: string): NightType | null {
  if (/^Stats \$10/.test(name)) return '10';
  if (/^Stats \$20/.test(name)) return '20';
  if (/^Stats \$50/.test(name)) return '50';
  if (/^One-offs/.test(name)) return 'one-off';
  return null;
}

export function normalizeWorkbooks() {
  const players = new Map<string, Player>();
  const nights: PokerNight[] = [];
  const results: PlayerResult[] = [];
  const issues: ValidationIssue[] = [];
  const seenNights = new Set<string>();

  for (const wb of loadWorkbooks()) {
    for (const sheetName of wb.workbook.SheetNames) {
      const nt = sheetType(sheetName);
      if (!nt) continue;

      const rows = sheetRows(wb.workbook.Sheets[sheetName]);
      let current: PokerNight | null = null;

      rows.forEach((r, i) => {
        const row = i + 1;
        const maybeDate = dateFrom(r[1] ?? r[2], wb.seasonId);
        const first = text(r[0]);

        if (maybeDate && (!first || first.toLowerCase() === 'player')) {
          const id = `${wb.seasonId}-${nt}-${maybeDate}`;
          current = {
            id,
            date: maybeDate,
            title: `${nt === 'one-off' ? 'One-off' : `$${nt} night`} · ${maybeDate}`,
            seasonId: wb.seasonId,
            nightType: nt,
            notes: nt === 'one-off' ? 'Excluded from workbook totals' : '',
          };
          if (!seenNights.has(id)) {
            seenNights.add(id);
            nights.push(current);
          }
          return;
        }

        if (!current || !first || first.toLowerCase() === 'player') return;

        const buyIn = money(r[2]);
        const cashOut = money(r[3]);
        const net = money(r[4]);
        if (buyIn == null || cashOut == null) {
          issues.push({
            workbook: wb.file,
            sheet: sheetName,
            row,
            severity: 'warning',
            message: `Skipped ${first}: malformed buy-in/cash-out`,
          });
          return;
        }

        const id = canonicalPlayerId(first);
        const display = first.trim();
        const p = players.get(id) ?? { id, displayName: display, aliases: [] };
        if (!p.aliases.includes(display)) p.aliases.push(display);
        if (display.length < p.displayName.length) p.displayName = display;
        players.set(id, p);

        const profit = net ?? Number((cashOut - buyIn).toFixed(2));
        results.push({ nightId: current.id, playerId: id, buyIn, cashOut, profit, sourceName: display });
      });
    }
  }

  for (const n of nights) {
    const ordered = results.filter((r) => r.nightId === n.id).sort((a, b) => b.profit - a.profit);
    ordered.forEach((r, i) => {
      r.placement = i + 1;
    });
    const sum = ordered.reduce((s, r) => s + r.profit, 0);
    if (Math.abs(sum) > 0.01) {
      issues.push({
        workbook: 'normalized',
        sheet: n.id,
        row: 0,
        severity: 'warning',
        message: `Night profit reconciles to ${sum.toFixed(2)}`,
      });
    }
  }

  const data = {
    players: [...players.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    nights: nights.sort((a, b) => a.date.localeCompare(b.date)),
    results,
    issues,
  };
  data.players.forEach((p) => playerSchema.parse(p));
  data.nights.forEach((n) => nightSchema.parse(n));
  data.results.forEach((r) => resultSchema.parse(r));
  return data;
}
