import type { PokerNight, Player, PlayerResult, ValidationIssue } from '@/types/poker';
import { UNC_LEAGUE_ID } from './types';

export interface NormalizedWorkbookData {
  players: Player[];
  nights: PokerNight[];
  results: PlayerResult[];
  issues: ValidationIssue[];
}

export interface ImportWorkbookSource {
  file: string;
  seasonId: string;
  sha256: string;
}

interface ImportPlayer {
  id: string;
  displayName: string;
  aliases: string[];
}

interface ImportResult {
  playerId: string;
  buyInCents: number;
  cashOutCents: number;
  placement: number | null;
  legacyProfitCents: number | null;
}

interface ImportGame {
  id: string;
  title: string;
  date: string;
  seasonId: string;
  nightType: PokerNight['nightType'];
  format: 'cash';
  status: 'completed';
  notes: string;
  sourceRef: string;
  results: ImportResult[];
}

export interface WorkbookImportManifest {
  schemaVersion: 1;
  generatedAt: string;
  league: { id: string; slug: 'unc-poker'; name: 'UNC Poker' };
  sources: ImportWorkbookSource[];
  counts: { players: number; games: number; results: number; legacyProfitOverrides: number; normalizerIssues: number };
  assumptions: string[];
  normalizerIssues: ValidationIssue[];
  games: {
    id: string;
    sourceRef: string;
    resultCount: number;
    sourceProfitTotalCents: number;
    cashFlowTotalCents: number;
    legacyProfitOverrides: number;
    warnings: string[];
  }[];
  safety: string[];
}

export interface WorkbookImport {
  sql: string;
  manifest: WorkbookImportManifest;
  players: ImportPlayer[];
  games: ImportGame[];
}

function cents(value: number, context: string): number {
  const converted = Math.round(value * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(converted) || converted < -2147483648 || converted > 2147483647) {
    throw new Error(`${context}: monetary value is outside the supported cent range`);
  }
  // Ignore ordinary floating-point noise, but never silently round source money.
  if (Math.abs(value * 100 - converted) > 0.000001) {
    throw new Error(`${context}: source money has sub-cent precision (${value})`);
  }
  return converted;
}

function uniqueById<T extends { id: string }>(values: T[], context: string): Map<string, T> {
  const entries = new Map<string, T>();
  for (const value of values) {
    if (!value.id.trim()) throw new Error(`${context}: missing canonical ID`);
    if (entries.has(value.id)) throw new Error(`${context}: duplicate canonical ID ${value.id}`);
    entries.set(value.id, value);
  }
  return entries;
}

function sqlText(value: string): string {
  if (value.includes('\0')) throw new Error('PostgreSQL text cannot contain a null byte');
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNumber(value: number | null): string {
  return value == null ? 'null' : String(value);
}

function sqlRows(table: string, columns: string[], rows: string[][]): string {
  if (!rows.length) return '';
  return `insert into ${table} (${columns.join(', ')}) values\n${rows.map((row) => `  (${row.join(', ')})`).join(',\n')};\n`;
}

/** Build an offline, reviewable import. This function never connects to Supabase. */
export function buildWorkbookImport(
  data: NormalizedWorkbookData,
  options: { sources?: ImportWorkbookSource[]; generatedAt?: string } = {},
): WorkbookImport {
  const playerMap = uniqueById(data.players, 'Players');
  const nightMap = uniqueById(data.nights, 'Games');
  const playerNames = new Set<string>();
  for (const player of playerMap.values()) {
    const name = player.displayName.trim().toLowerCase();
    if (!name || playerNames.has(name)) throw new Error(`Conflicting canonical player display name ${player.displayName}`);
    playerNames.add(name);
  }
  const sources = [...(options.sources ?? [])].sort((a, b) => a.file.localeCompare(b.file));
  const sourceBySeason = new Map<string, ImportWorkbookSource>();
  for (const source of sources) {
    if (sourceBySeason.has(source.seasonId)) throw new Error(`Duplicate source season ${source.seasonId}`);
    sourceBySeason.set(source.seasonId, source);
  }
  const grouped = new Map<string, ImportResult[]>();
  const seenResults = new Set<string>();
  for (const result of data.results) {
    if (!nightMap.has(result.nightId)) throw new Error(`Result references missing game ${result.nightId}`);
    if (!playerMap.has(result.playerId)) throw new Error(`Result references missing player ${result.playerId}`);
    const key = JSON.stringify([result.nightId, result.playerId]);
    if (seenResults.has(key)) throw new Error(`Duplicate result for game ${result.nightId}, player ${result.playerId}`);
    seenResults.add(key);
    const buyInCents = cents(result.buyIn, `${result.nightId}/${result.playerId} buy-in`);
    const cashOutCents = cents(result.cashOut, `${result.nightId}/${result.playerId} cash-out`);
    const profitCents = cents(result.profit, `${result.nightId}/${result.playerId} source Net`);
    if (buyInCents < 0 || cashOutCents < 0) throw new Error(`Negative buy-in/cash-out for ${result.nightId}/${result.playerId}`);
    if (buyInCents > 100000000 || cashOutCents > 100000000) throw new Error(`Buy-in/cash-out exceeds database amount limit for ${result.nightId}/${result.playerId}`);
    if (result.placement != null && (!Number.isSafeInteger(result.placement) || result.placement < 1)) {
      throw new Error(`Invalid inferred placement for ${result.nightId}/${result.playerId}`);
    }
    const rows = grouped.get(result.nightId) ?? [];
    rows.push({
      playerId: result.playerId,
      buyInCents,
      cashOutCents,
      placement: result.placement ?? null,
      legacyProfitCents: profitCents === cashOutCents - buyInCents ? null : profitCents,
    });
    grouped.set(result.nightId, rows);
  }

  const gameReports: WorkbookImportManifest['games'] = [];
  const games = [...nightMap.values()].sort((a, b) => a.id.localeCompare(b.id)).map((night): ImportGame => {
    const source = sourceBySeason.get(night.seasonId);
    if (sources.length && !source) throw new Error(`Missing workbook source for ${night.seasonId}`);
    const file = source?.file ?? `${night.seasonId}.xlsx`;
    const sourceRef = `workbook:v1:${file}#${night.id}`;
    const results = (grouped.get(night.id) ?? []).sort((a, b) => a.playerId.localeCompare(b.playerId));
    const cashFlowTotalCents = results.reduce((sum, row) => sum + row.cashOutCents - row.buyInCents, 0);
    const sourceProfitTotalCents = results.reduce((sum, row) => sum + (row.legacyProfitCents ?? row.cashOutCents - row.buyInCents), 0);
    const legacyProfitOverrides = results.filter((row) => row.legacyProfitCents != null).length;
    const warnings: string[] = [];
    if (!results.length) warnings.push('No valid result rows; the source game is preserved for review.');
    if (sourceProfitTotalCents !== 0) warnings.push(`Historical source Net does not reconcile (${sourceProfitTotalCents} cents); preserved without adjustment.`);
    if (cashFlowTotalCents !== 0) warnings.push(`Historical cash flow does not reconcile (${cashFlowTotalCents} cents); preserved without adjustment.`);
    if (legacyProfitOverrides) warnings.push(`${legacyProfitOverrides} source Net value(s) differ from cash-out minus buy-in and are preserved as legacy_profit_cents.`);
    const seasonYear = night.seasonId.match(/\d{4}$/)?.[0];
    if (seasonYear && !night.date.startsWith(seasonYear)) warnings.push(`Source date ${night.date} differs from season year ${seasonYear}; original date preserved.`);
    gameReports.push({ id: night.id, sourceRef, resultCount: results.length, sourceProfitTotalCents, cashFlowTotalCents, legacyProfitOverrides, warnings });
    const importNotes = `Imported from ${file}. Cash format assumed; placements inferred by descending source Net, not recorded tournament finishes.`;
    return {
      ...night,
      format: 'cash',
      status: 'completed',
      notes: [night.notes, importNotes, ...warnings].filter(Boolean).join('\n'),
      sourceRef,
      results,
    };
  });
  const players = [...playerMap.values()].sort((a, b) => a.id.localeCompare(b.id)).map((player) => ({ ...player, aliases: [...player.aliases] }));
  const manifest: WorkbookImportManifest = {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    league: { id: UNC_LEAGUE_ID, slug: 'unc-poker', name: 'UNC Poker' },
    sources,
    counts: {
      players: players.length,
      games: games.length,
      results: data.results.length,
      legacyProfitOverrides: gameReports.reduce((sum, report) => sum + report.legacyProfitOverrides, 0),
      normalizerIssues: data.issues.length,
    },
    assumptions: [
      'All existing workbooks belong to UNC Poker; canonical player and game IDs are retained.',
      'Workbooks do not establish cash versus tournament format. Imported games assume cash; an organizer should review the format.',
      'Placements are inferred by descending normalized source Net. They are not explicit tournament placements; ties retain the normalizer order.',
      'Valid source Net is authoritative for historical standings. Missing or malformed Net falls back to cash-out minus buy-in in the existing normalizer.',
      'Missing or malformed buy-in/cash-out rows reported by the normalizer remain excluded; no values are fabricated.',
    ],
    normalizerIssues: data.issues.map((issue) => ({ ...issue })),
    games: gameReports,
    safety: [
      'Generated SQL is a single transaction and performs no live writes until manually executed.',
      'Any conflicting canonical player, game, source reference, or existing result set aborts the transaction.',
      'Identical existing games are skipped as a whole; results are inserted only for newly inserted games.',
      'Audit records for portal-deleted game IDs prevent accidental restoration of deleted historical games.',
      'The import never updates or deletes existing games, results, players, or league memberships.',
    ],
  };

  return { sql: createImportSql(players, games), manifest, players, games };
}

function createImportSql(players: ImportPlayer[], games: ImportGame[]): string {
  const leagueId = sqlText(UNC_LEAGUE_ID);
  return `-- UNC Poker workbook import. Review the companion manifest before execution.
-- Apply the application schema first. Execute all statements together in Supabase SQL Editor.
-- Identical imports are skipped; conflicting or portal-edited records abort the entire transaction.
begin;
set local standard_conforming_strings = on;
lock table public.leagues, public.players, public.games, public.game_results in share row exclusive mode;

create temporary table _poker_import_players (
  id text primary key, display_name text not null, aliases text[] not null
) on commit drop;
create temporary table _poker_import_games (
  id text primary key, title text not null, date date not null, season_id text not null,
  night_type text not null, format text not null, status text not null, notes text not null, source_ref text not null
) on commit drop;
create temporary table _poker_import_results (
  game_id text not null, player_id text not null, buy_in_cents bigint not null,
  cash_out_cents bigint not null, placement integer, legacy_profit_cents bigint,
  primary key (game_id, player_id)
) on commit drop;

${sqlRows('_poker_import_players', ['id', 'display_name', 'aliases'], players.map((player) => [sqlText(player.id), sqlText(player.displayName), `array[${player.aliases.map(sqlText).join(', ')}]::text[]`]))}
${sqlRows('_poker_import_games', ['id', 'title', 'date', 'season_id', 'night_type', 'format', 'status', 'notes', 'source_ref'], games.map((game) => [sqlText(game.id), sqlText(game.title), sqlText(game.date), sqlText(game.seasonId), sqlText(game.nightType), sqlText(game.format), sqlText(game.status), sqlText(game.notes), sqlText(game.sourceRef)]))}
${sqlRows('_poker_import_results', ['game_id', 'player_id', 'buy_in_cents', 'cash_out_cents', 'placement', 'legacy_profit_cents'], games.flatMap((game) => game.results.map((result) => [sqlText(game.id), sqlText(result.playerId), sqlNumber(result.buyInCents), sqlNumber(result.cashOutCents), sqlNumber(result.placement), sqlNumber(result.legacyProfitCents)])))}
do $poker_import$
declare conflict_id text;
begin
  if exists (select 1 from public.leagues where id = ${leagueId}::uuid and slug <> 'unc-poker') then
    raise exception 'Workbook import league ID belongs to a different league. No changes were applied.';
  end if;

  select s.id into conflict_id
  from _poker_import_games s
  where not exists (select 1 from public.games g where g.league_id = ${leagueId}::uuid and g.id = s.id)
    and exists (select 1 from public.game_audit_log a where a.league_id = ${leagueId}::uuid and a.game_id = s.id and a.action = 'delete')
  limit 1;
  if conflict_id is not null then
    raise exception 'Workbook import includes previously deleted game %. Portal deletions will not be restored. No changes were applied.', conflict_id;
  end if;

  select p.id into conflict_id
  from public.players p join _poker_import_players s on p.id = s.id
  where p.league_id = ${leagueId}::uuid
    and (p.display_name is distinct from s.display_name
      or array(select unnest(p.aliases) order by 1) is distinct from array(select unnest(s.aliases) order by 1))
  limit 1;
  if conflict_id is not null then
    raise exception 'Workbook import conflicts with existing player %. No changes were applied.', conflict_id;
  end if;

  select g.id into conflict_id
  from public.games g join _poker_import_games s on g.id = s.id
  where g.league_id = ${leagueId}::uuid
    and (g.source_ref is distinct from s.source_ref or g.title is distinct from s.title
      or g.date is distinct from s.date or g.season_id is distinct from s.season_id
      or g.night_type is distinct from s.night_type or g.format is distinct from s.format
      or g.status is distinct from s.status or g.notes is distinct from s.notes)
  limit 1;
  if conflict_id is not null then
    raise exception 'Workbook import conflicts with existing game %. Review its source or portal edits. No changes were applied.', conflict_id;
  end if;

  select g.id into conflict_id
  from public.games g join _poker_import_games s on g.id = s.id
  where g.league_id = ${leagueId}::uuid and (
    exists (
      (select r.player_id, r.buy_in_cents, r.cash_out_cents, r.placement, r.legacy_profit_cents
       from public.game_results r where r.league_id = g.league_id and r.game_id = g.id)
      except
      (select r.player_id, r.buy_in_cents, r.cash_out_cents, r.placement, r.legacy_profit_cents
       from _poker_import_results r where r.game_id = g.id)
    ) or exists (
      (select r.player_id, r.buy_in_cents, r.cash_out_cents, r.placement, r.legacy_profit_cents
       from _poker_import_results r where r.game_id = g.id)
      except
      (select r.player_id, r.buy_in_cents, r.cash_out_cents, r.placement, r.legacy_profit_cents
       from public.game_results r where r.league_id = g.league_id and r.game_id = g.id)
    )
  ) limit 1;
  if conflict_id is not null then
    raise exception 'Workbook import conflicts with existing results for game %. Portal results will not be restored or overwritten. No changes were applied.', conflict_id;
  end if;
end;
$poker_import$;

insert into public.leagues (id, slug, name)
values (${leagueId}::uuid, 'unc-poker', 'UNC Poker')
on conflict (id) do nothing;

insert into public.players (league_id, id, display_name, aliases)
select ${leagueId}::uuid, id, display_name, aliases from _poker_import_players
on conflict (league_id, id) do nothing;

-- Only the games inserted in this statement may receive results.
-- A rerun cannot recreate removed players/results on an existing game.
with inserted_games as (
  insert into public.games (league_id, id, title, date, season_id, night_type, format, status, notes, source_ref)
  select ${leagueId}::uuid, id, title, date, season_id, night_type, format, status, notes, source_ref
  from _poker_import_games
  on conflict (league_id, id) do nothing
  returning league_id, id
)
insert into public.game_results (league_id, game_id, player_id, buy_in_cents, cash_out_cents, placement, legacy_profit_cents)
select g.league_id, r.game_id, r.player_id, r.buy_in_cents, r.cash_out_cents, r.placement, r.legacy_profit_cents
from _poker_import_results r join inserted_games g on g.id = r.game_id;

commit;
`;
}
