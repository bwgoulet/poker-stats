import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { UNC_LEAGUE_ID } from '@/lib/backend/types';

const migration = '202610090005_correct_historical_results.sql';
const correctionSql = readFileSync(`supabase/migrations/${migration}`, 'utf8');
const targetGames = [
  'fall-2025-one-off-2025-10-03', 'fall-2025-20-2025-10-16', 'fall-2025-one-off-2025-10-10',
  'fall-2025-one-off-2025-10-27', 'spring-2026-20-2026-02-04', 'summer-2026-20-2026-08-16',
  'fall-2026-one-off-2026-09-03',
];

async function database() {
  const db = new PGlite();
  await db.exec(readFileSync('supabase/tests/bootstrap.sql', 'utf8'));
  for (const file of readdirSync('supabase/migrations').filter(file => file.endsWith('.sql') && file < migration).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  return db;
}

async function snapshot(db: PGlite) {
  return {
    games: (await db.query<Record<string, unknown>>('select * from public.games order by league_id, id')).rows,
    results: (await db.query<Record<string, unknown>>('select * from public.game_results order by league_id, game_id, player_id')).rows,
    audit: (await db.query<Record<string, unknown>>('select * from public.game_audit_log order by game_id, id')).rows,
  };
}

it('corrects exactly seven historical games, preserves counting differences and safely reruns', async () => {
  const db = await database();
  try {
    const before = await snapshot(db);
    await db.exec(correctionSql);
    const after = await snapshot(db);
    expect(after.results).toHaveLength(697);
    expect(after.results.filter(row => row.legacy_profit_cents !== null)).toHaveLength(0);
    expect(after.results.find(row => row.game_id === targetGames[0] && row.player_id === 'drew')).toMatchObject({
      buy_in_cents: 5000, cash_out_cents: 3610, legacy_profit_cents: null,
    });
    expect(after.results.filter(row => !targetGames.includes(String(row.game_id)))).toEqual(
      before.results.filter(row => !targetGames.includes(String(row.game_id))),
    );
    expect(after.games.filter(row => !targetGames.includes(String(row.id)))).toEqual(
      before.games.filter(row => !targetGames.includes(String(row.id))),
    );
    for (const row of before.results) {
      const corrected = after.results.find(candidate => candidate.game_id === row.game_id && candidate.player_id === row.player_id)!;
      expect([corrected.buy_in_cents, corrected.cash_out_cents]).toEqual([row.buy_in_cents, row.cash_out_cents]);
    }
    expect(after.games.filter(row => targetGames.includes(String(row.id))).every(row => row.version === 2)).toBe(true);
    expect(after.audit).toHaveLength(7);
    expect(after.audit.every(row => row.action === 'update' && row.before_data && row.after_data)).toBe(true);
    const verified = await db.query(readFileSync('supabase/imports/202610090005/verify.sql', 'utf8'));
    expect(verified.rows).toEqual([{ expected_count: 7, matched_count: 7, passed: true, mismatches: [] }]);
    const difference = (await db.query<{ difference: string }>(`
      select sum(cash_out_cents - buy_in_cents)::text as difference from public.game_results
      where league_id = $1 and game_id = $2`, [UNC_LEAGUE_ID, targetGames[0]])).rows[0].difference;
    expect(difference).toBe('0');
    const mismatchCount = (await db.query<{ count: number }>(`
      select count(*)::integer as count from (
        select game_id from public.game_results group by league_id, game_id
        having sum(cash_out_cents - buy_in_cents) <> 0
      ) games`)).rows[0].count;
    expect(mismatchCount).toBe(34);
    const ranks = (await db.query<{ player_id: string; placement: number; profit: number }>(`
      select player_id, placement, cash_out_cents - buy_in_cents as profit from public.game_results
      where league_id = $1 and game_id = $2 order by placement`, [UNC_LEAGUE_ID, targetGames[0]])).rows;
    expect(ranks.map(row => row.placement)).toEqual(ranks.map((_, index) => index + 1));
    expect(ranks.map(row => row.profit)).toEqual(ranks.map(row => row.profit).sort((a, b) => b - a));
    await db.exec(correctionSql);
    expect(await snapshot(db)).toEqual(after);
  } finally { await db.close(); }
}, 30000);

it('aborts the entire correction if a result or game has been edited since import', async () => {
  const db = await database();
  try {
    await db.query("update public.game_results set cash_out_cents = 1500 where game_id = $1 and player_id = 'chris'", [targetGames[1]]);
    const edited = await snapshot(db);
    await expect(db.exec(correctionSql)).rejects.toThrow('conflicts with an existing result');
    await db.exec('rollback;');
    expect(await snapshot(db)).toEqual(edited);
    await db.query("update public.game_results set cash_out_cents = 1540 where game_id = $1 and player_id = 'chris'", [targetGames[1]]);
    await db.query('update public.games set version = 2 where id = $1', [targetGames[1]]);
    const versioned = await snapshot(db);
    await expect(db.exec(correctionSql)).rejects.toThrow('Review portal edits first');
    await db.exec('rollback;');
    expect(await snapshot(db)).toEqual(versioned);
  } finally { await db.close(); }
}, 30000);
