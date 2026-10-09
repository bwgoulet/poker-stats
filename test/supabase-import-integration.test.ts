import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { buildWorkbookImport, type NormalizedWorkbookData } from '@/lib/backend/import-workbooks';
import { normalizeWorkbooks } from '@/lib/data/normalize-workbooks';
import { UNC_LEAGUE_ID } from '@/lib/backend/types';

async function bootstrapDatabase() {
  const db = new PGlite();
  await db.exec(readFileSync(resolve('supabase/tests/bootstrap.sql'), 'utf8'));
  for (const migration of readdirSync(resolve('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort()) {
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

describe('workbook import on PostgreSQL', () => {
  it('imports real workbooks, preserves standings, skips exact reruns and rejects edits atomically', async () => {
    const normalized = normalizeWorkbooks();
    const imported = buildWorkbookImport(normalized);
    const db = await bootstrapDatabase();
    try {
      await db.exec(imported.sql);
      const counts = await recordCounts(db);
      expect(counts).toEqual({ players: normalized.players.length, games: normalized.nights.length, results: normalized.results.length });

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
});
