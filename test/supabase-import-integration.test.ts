import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { buildWorkbookImport, type NormalizedWorkbookData } from '@/lib/backend/import-workbooks';
import { buildWorkbookVerificationSql } from '@/lib/backend/verify-workbooks';
import { normalizeWorkbooks } from '@/lib/data/normalize-workbooks';
import { UNC_LEAGUE_ID } from '@/lib/backend/types';

const historicalMigration = '202610090004_import_historical_workbooks.sql';
const historicalArtifacts = 'supabase/imports/202610090004';

async function bootstrapDatabase(includeHistoricalData = false) {
  const db = new PGlite();
  await db.exec(readFileSync(resolve('supabase/tests/bootstrap.sql'), 'utf8'));
  for (const migration of readdirSync(resolve('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort()) {
    // Synthetic import tests need an empty league; the committed migration is
    // exercised separately against the complete migration chain below.
    if (migration === historicalMigration && !includeHistoricalData) continue;
    await db.exec(readFileSync(resolve('supabase/migrations', migration), 'utf8'));
  }
  return db;
}

async function recordCounts(db: PGlite) {
  return (await db.query<{ players: number; games: number; results: number }>(`
    select (select count(*)::integer from public.players) as players,
      (select count(*)::integer from public.games) as games,
      (select count(*)::integer from public.game_results) as results
  `)).rows[0];
}

interface VerificationRow {
  record_type: string;
  expected_count: number;
  matched_count: number;
  missing_count: number;
  changed_count: number;
  unexpected_count: number;
  passed: boolean;
  mismatches: { key: string[]; reason: string }[];
}

async function verify(db: PGlite, sql: string) {
  const results = await db.exec(sql);
  return results.find(result => result.fields.some(field => field.name === 'passed'))!.rows as VerificationRow[];
}

describe('workbook import on PostgreSQL', () => {
  it('applies the committed historical migration and exposes verified data through RLS', async () => {
    const normalized = normalizeWorkbooks();
    const imported = buildWorkbookImport(normalized);
    const sql = readFileSync(resolve('supabase/migrations', historicalMigration), 'utf8');
    const verification = readFileSync(resolve(historicalArtifacts, 'verify.sql'), 'utf8');
    const manifest = JSON.parse(readFileSync(resolve(historicalArtifacts, 'manifest.json'), 'utf8'));
    expect(sql).toBe(imported.sql);
    expect(verification).toBe(buildWorkbookVerificationSql(imported));
    expect(manifest.counts).toEqual(imported.manifest.counts);
    expect(manifest.sources).toHaveLength(4);
    for (const source of manifest.sources) {
      expect(createHash('sha256').update(readFileSync(resolve('data', source.file))).digest('hex')).toBe(source.sha256);
    }

    const db = await bootstrapDatabase(true);
    try {
      const expected = { players: normalized.players.length, games: normalized.nights.length, results: normalized.results.length };
      expect(await recordCounts(db)).toEqual(expected);
      expect((await verify(db, verification)).every(row => row.passed)).toBe(true);
      await db.exec(sql);
      expect(await recordCounts(db)).toEqual(expected);

      // A newly signed-in user needs no league membership to read public history.
      const userId = '00000000-0000-4000-8000-000000000099';
      await db.query('insert into auth.users (id, email) values ($1, $2)', [userId, 'historical-reader@example.test']);
      await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId, role: 'authenticated' })]);
      await db.exec('set role authenticated;');
      expect(await recordCounts(db)).toEqual(expected);
      expect((await db.query<{ count: number }>("select count(*)::integer as count from public.games where status = 'completed'")).rows[0].count).toBe(expected.games);
      await db.exec('reset role; set role anon;');
      expect(await recordCounts(db)).toEqual(expected);
    } finally {
      await db.close();
    }
  }, 30000);

  it('imports real workbooks, preserves standings, skips exact reruns and rejects edits atomically', async () => {
    const normalized = normalizeWorkbooks();
    const imported = buildWorkbookImport(normalized);
    const db = await bootstrapDatabase();
    try {
      await db.exec(imported.sql);
      const counts = await recordCounts(db);
      expect(counts).toEqual({ players: normalized.players.length, games: normalized.nights.length, results: normalized.results.length });
      const verificationSql = buildWorkbookVerificationSql(imported);
      const verified = await verify(db, verificationSql);
      expect(verified.map(row => [row.record_type, row.expected_count, row.matched_count, row.passed])).toEqual([
        ['game', normalized.nights.length, normalized.nights.length, true],
        ['player', normalized.players.length, normalized.players.length, true],
        ['result', normalized.results.length, normalized.results.length, true],
      ]);
      expect(await recordCounts(db)).toEqual(counts);

      const originalStandings = new Map<string, number>();
      for (const result of normalized.results) {
        originalStandings.set(result.playerId, (originalStandings.get(result.playerId) ?? 0) + Math.round(result.profit * 100));
      }
      const storedStandings = await db.query<{ player_id: string; profit_cents: string }>(`
        select player_id, sum(coalesce(legacy_profit_cents, cash_out_cents - buy_in_cents))::text as profit_cents
        from public.game_results where league_id = $1 group by player_id
      `, [UNC_LEAGUE_ID]);
      expect(new Map(storedStandings.rows.map((row) => [row.player_id, Number(row.profit_cents)]))).toEqual(originalStandings);

      // This second full transaction must insert no duplicate game or result.
      await db.exec(imported.sql);
      expect(await recordCounts(db)).toEqual(counts);
      expect((await db.query<{ count: number }>('select count(*)::integer as count from public.games where version <> 1')).rows[0].count).toBe(0);

      const game = imported.games.find((candidate) => candidate.results.length > 1)!;
      const removedResult = game.results[0];
      await db.query('delete from public.game_results where league_id = $1 and game_id = $2 and player_id = $3', [UNC_LEAGUE_ID, game.id, removedResult.playerId]);
      const countsAfterPortalEdit = await recordCounts(db);
      const candidateData: NormalizedWorkbookData = {
        players: [...normalized.players, { id: 'new-import-player', displayName: 'New Import Player', aliases: [] }],
        nights: [...normalized.nights, { id: 'fall-2026-20-2026-10-01-new-import', title: 'New import candidate', date: '2026-10-01', seasonId: 'fall-2026', nightType: '20' }],
        results: [...normalized.results, { nightId: 'fall-2026-20-2026-10-01-new-import', playerId: 'new-import-player', buyIn: 20, cashOut: 20, profit: 0, placement: 1, sourceName: 'New Import Player' }],
        issues: normalized.issues,
      };
      await expect(db.exec(buildWorkbookImport(candidateData).sql)).rejects.toThrow('Workbook import conflicts with existing results');
      // PostgreSQL leaves failed transactions aborted until the caller rolls back.
      await db.exec('rollback;');
      expect(await recordCounts(db)).toEqual(countsAfterPortalEdit);
      expect((await db.query('select id from public.players where id = $1', ['new-import-player'])).rows).toHaveLength(0);
      expect((await db.query('select * from public.game_results where league_id = $1 and game_id = $2 and player_id = $3', [UNC_LEAGUE_ID, game.id, removedResult.playerId])).rows).toHaveLength(0);

      // Restore the fixture row, then verify the same protection for edited game provenance.
      await db.query(`insert into public.game_results
        (league_id, game_id, player_id, buy_in_cents, cash_out_cents, placement, legacy_profit_cents)
        values ($1, $2, $3, $4, $5, $6, $7)`, [UNC_LEAGUE_ID, game.id, removedResult.playerId, removedResult.buyInCents, removedResult.cashOutCents, removedResult.placement, removedResult.legacyProfitCents]);
      await db.query("update public.games set title = 'Portal edited title', version = version + 1, source_ref = null where league_id = $1 and id = $2", [UNC_LEAGUE_ID, game.id]);
      await expect(db.exec(imported.sql)).rejects.toThrow('Workbook import conflicts with existing game');
      await db.exec('rollback;');
      const edited = (await db.query<{ title: string; version: number; source_ref: null }>('select title, version, source_ref from public.games where league_id = $1 and id = $2', [UNC_LEAGUE_ID, game.id])).rows[0];
      expect(edited).toEqual({ title: 'Portal edited title', version: 2, source_ref: null });
      expect(await recordCounts(db)).toEqual(counts);

      const ownerId = '00000000-0000-4000-8000-000000000011';
      await db.query('insert into auth.users (id, email) values ($1, $2)', [ownerId, 'import-test@example.com']);
      await db.query("insert into public.league_members (league_id, user_id, role) values ($1, $2, 'owner')", [UNC_LEAGUE_ID, ownerId]);
      await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: ownerId, email: 'import-test@example.com' })]);
      await db.query('select public.delete_game($1, $2, $3)', [UNC_LEAGUE_ID, game.id, 2]);
      const countsAfterDeletion = await recordCounts(db);
      expect(countsAfterDeletion.games).toBe(counts.games - 1);
      await expect(db.exec(imported.sql)).rejects.toThrow('previously deleted game');
      await db.exec('rollback;');
      expect(await recordCounts(db)).toEqual(countsAfterDeletion);
      expect((await db.query('select id from public.games where league_id = $1 and id = $2', [UNC_LEAGUE_ID, game.id])).rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  }, 30000);

  it('reports missing, changed and extra historical rows without changing data or blocking new games', async () => {
    const source: NormalizedWorkbookData = {
      players: [
        { id: 'alex', displayName: "Alex O'Brien", aliases: ['Z', 'A', '\u{1F600}', '\uE000', 'literal\\u0000'] },
        { id: 'sam', displayName: 'Sam', aliases: [] },
      ],
      nights: [{ id: 'historical', title: "Night's results", date: '2026-09-01', seasonId: 'fall-2026', nightType: '20' }],
      results: [
        { nightId: 'historical', playerId: 'alex', buyIn: 20, cashOut: 30, profit: 10, placement: 1, sourceName: 'Alex' },
        { nightId: 'historical', playerId: 'sam', buyIn: 20, cashOut: 10, profit: -10, placement: 2, sourceName: 'Sam' },
      ],
      issues: [],
    };
    const imported = buildWorkbookImport(source);
    const sql = buildWorkbookVerificationSql(imported);
    const db = await bootstrapDatabase();
    try {
      const missing = await verify(db, sql);
      expect(missing.map(row => [row.record_type, row.missing_count, row.passed])).toEqual([
        ['game', 1, false], ['player', 2, false], ['result', 2, false],
      ]);
      expect(await recordCounts(db)).toEqual({ players: 0, games: 0, results: 0 });
      await db.exec(imported.sql);
      // Unrelated new records and the same IDs in another league must not affect verification.
      await db.exec(`
        insert into public.players (league_id, id, display_name, aliases)
          values ('${UNC_LEAGUE_ID}', 'new-player', 'New Player', '{}');
        insert into public.games (league_id, id, title, date, season_id, night_type, format, status)
          values ('${UNC_LEAGUE_ID}', 'new-game', 'New Game', '2026-10-01', 'fall-2026', '20', 'cash', 'draft');
        insert into public.game_results (league_id, game_id, player_id, buy_in_cents, cash_out_cents)
          values ('${UNC_LEAGUE_ID}', 'new-game', 'new-player', 2000, 2000);
        insert into public.leagues (id, slug, name)
          values ('00000000-0000-4000-8000-000000000002', 'other', 'Other');
        insert into public.players (league_id, id, display_name, aliases)
          values ('00000000-0000-4000-8000-000000000002', 'alex', 'Different Alex', '{}');
      `);
      expect((await verify(db, sql)).every(row => row.passed)).toBe(true);
      await db.query('update public.players set aliases = $1 where league_id = $2 and id = $3', [['A', 'Z', '\uE000', '\u{1F600}', 'literal\\u0000'], UNC_LEAGUE_ID, 'alex']);
      expect((await verify(db, sql)).every(row => row.passed)).toBe(true);
      await db.query('update public.game_results set legacy_profit_cents = 900 where league_id = $1 and game_id = $2 and player_id = $3', [UNC_LEAGUE_ID, 'historical', 'alex']);
      await db.query("update public.games set title = 'Edited history' where league_id = $1 and id = $2", [UNC_LEAGUE_ID, 'historical']);
      await db.query('delete from public.game_results where league_id = $1 and game_id = $2 and player_id = $3', [UNC_LEAGUE_ID, 'historical', 'sam']);
      await db.query('insert into public.game_results (league_id, game_id, player_id, buy_in_cents, cash_out_cents) values ($1, $2, $3, 2000, 1000)', [UNC_LEAGUE_ID, 'historical', 'new-player']);
      const before = await db.query('select * from public.game_results order by league_id, game_id, player_id');
      const checked = await verify(db, sql);
      expect(checked.find(row => row.record_type === 'game')).toMatchObject({ changed_count: 1, passed: false });
      expect(checked.find(row => row.record_type === 'player')).toMatchObject({ passed: true });
      expect(checked.find(row => row.record_type === 'result')).toMatchObject({
        expected_count: 2, matched_count: 0, changed_count: 1, missing_count: 1, unexpected_count: 1, passed: false,
        mismatches: [
          { key: ['historical', 'alex'], reason: 'changed' },
          { key: ['historical', 'new-player'], reason: 'unexpected' },
          { key: ['historical', 'sam'], reason: 'missing' },
        ],
      });
      expect((await db.query('select * from public.game_results order by league_id, game_id, player_id')).rows).toEqual(before.rows);
    } finally {
      await db.close();
    }
  }, 30000);
});
