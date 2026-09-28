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
  if (/^Online(?:\s|$)/i.test(name)) return 'online';
  return null;
}

function onlineColumn(rows: unknown[][]): number | null {
  for (const row of rows) {
    const index = row.findIndex((value) => text(value).toLowerCase() === 'online');
    if (index >= 0) return index;
  }
  return null;
}

function onlineMarker(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number') return value !== 0;
  return ['true', 'yes', 'y', 'x', 'online', '1'].includes(text(value).toLowerCase());
}

function isDateHeader(row: unknown[], season: string): boolean {
  const first = text(row[0]).toLowerCase();
  return Boolean(dateFrom(row[1] ?? row[2], season) && (!first || first === 'player'));
}

export function blockIsOnline(rows: unknown[][], start: number, column: number | null, season: string): boolean {
  if (column == null) return false;
  for (let index = start; index < rows.length; index += 1) {
    if (index > start && isDateHeader(rows[index], season)) break;
    const value = rows[index][column];
    if (text(value).toLowerCase() !== 'online' && onlineMarker(value)) return true;
  }
  return false;
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
      const onlineIndex = onlineColumn(rows);
      let current: PokerNight | null = null;

      rows.forEach((r, i) => {
        const row = i + 1;
        const maybeDate = dateFrom(r[1] ?? r[2], wb.seasonId);
        const first = text(r[0]);

        if (maybeDate && (!first || first.toLowerCase() === 'player')) {
          const nightType = blockIsOnline(rows, i, onlineIndex, wb.seasonId) ? 'online' : nt;
          const id = `${wb.seasonId}-${nightType}-${maybeDate}`;
          current = {
            id,
            date: maybeDate,
            title: `${nightType === 'one-off' ? 'One-off' : nightType === 'online' ? 'Online' : `$${nightType} night`} · ${maybeDate}`,
            seasonId: wb.seasonId,
            nightType,
            notes: nightType === 'one-off'
              ? 'Excluded from workbook totals'
              : nightType === 'online' && nt !== 'online'
                ? `Listed on the $${nt} sheet`
                : '',
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
