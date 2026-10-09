import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('classifies all 17 historical one-off/online games without changing results and reruns safely', async () => {
  const db = new PGlite();
  try {
    await db.exec(readFileSync('supabase/tests/bootstrap.sql', 'utf8'));
    for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql') && f < '202610090008').sort())
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    const before = (await db.query('select * from public.game_results order by game_id, player_id')).rows;
    const sql = readFileSync('supabase/migrations/202610090008_classify_historical_stakes.sql', 'utf8');
    await db.exec(sql);
    expect((await db.query('select * from public.game_results order by game_id, player_id')).rows).toEqual(before);
    const games = (await db.query<{night_type: string}>("select night_type from public.games where notes like '%Historical stake classification 008:%'")).rows;
    expect(games).toHaveLength(17);
    expect(games.filter(g => g.night_type === '10')).toHaveLength(10);
    expect(games.filter(g => g.night_type === '20')).toHaveLength(7);
    expect((await db.query("select id from public.games where night_type in ('one-off', 'online')")).rows).toEqual([]);
    const snapshot = (await db.query('select * from public.games order by id')).rows;
    await db.exec(sql);
    expect((await db.query('select * from public.games order by id')).rows).toEqual(snapshot);
    expect((await db.query("select id from public.game_audit_log where actor_snapshot->>'migration' = '202610090008'")).rows).toHaveLength(17);
  } finally { await db.close(); }
}, 30000);
