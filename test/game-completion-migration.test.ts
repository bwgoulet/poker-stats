import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { UNC_LEAGUE_ID, type GameInput } from '@/lib/backend/types';

const migrationDirectory = 'supabase/migrations';
const migration = '202610090007_allow_unbalanced_completed_games.sql';
const read = (file: string) => readFileSync(file, 'utf8');

it('uses unique Supabase migration versions so upgrades are not skipped', () => {
  const versions = readdirSync(migrationDirectory).filter(file => file.endsWith('.sql')).map(file => file.split('_')[0]);
  expect(new Set(versions).size).toBe(versions.length);
});

it('upgrades the rejecting database and saves the exact mismatched payouts', async () => {
  const db = new PGlite();
  const admin = '10000000-0000-4000-8000-000000000001';
  const game: GameInput = {
    title: 'Mismatch upgrade', date: '2026-10-09', seasonId: 'fall-2026', nightType: '20',
    format: 'cash', status: 'completed', notes: '',
    results: ['ben', 'jake', 'johnny', 'mason'].map((playerId, i) => ({
      playerId, buyInCents: 2000, cashOutCents: [4000, 2000, 0, 1000][i], placement: null,
    })),
  };
  const save = (payload: GameInput = game) => db.query<{ saved: { id: string; version: number } }>(
    'select public.save_game($1::uuid, $2::jsonb) as saved', [UNC_LEAGUE_ID, JSON.stringify(payload)],
  );
  try {
    await db.exec(read('supabase/tests/bootstrap.sql'));
    for (const file of readdirSync(migrationDirectory).filter(file => file.endsWith('.sql')).sort()) {
      if (file > '202610090003_discord_link_verification.sql') continue;
      await db.exec(read(`${migrationDirectory}/${file}`));
    }
    await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())', [admin, 'admin@example.test']);
    await db.query("update public.users set role='admin' where id=$1", [admin]);
    for (const row of game.results) {
      await db.query('insert into public.players(league_id,id,display_name) values ($1,$2,$2)', [UNC_LEAGUE_ID, row.playerId]);
    }
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: admin })]);
    await db.exec('set role authenticated');
    await expect(save()).rejects.toMatchObject({ code: '22023', message: expect.stringContaining('balanced totals') });
    await db.exec('reset role');
    await db.exec(read(`${migrationDirectory}/${migration}`));
    // The SQL editor repair and CLI upgrade can safely run the same replacement.
    await db.exec(read(`${migrationDirectory}/${migration}`));
    await db.exec('set role authenticated');
    const { id } = (await save()).rows[0].saved;
    const stored = await db.query<{ buy_in_cents: number; cash_out_cents: number }>(
      'select buy_in_cents,cash_out_cents from public.game_results where game_id=$1 order by player_id', [id],
    );
    expect(stored.rows.map(row => row.buy_in_cents)).toEqual([2000, 2000, 2000, 2000]);
    expect(stored.rows.map(row => row.cash_out_cents)).toEqual([4000, 2000, 0, 1000]);
    expect((await save({ ...game, id, expectedVersion: 1 })).rows[0].saved.version).toBe(2);
    const invalid = { ...game, results: game.results.map((row, i) => ({ ...row, cashOutCents: i === 0 ? null : row.cashOutCents })) };
    await expect(save(invalid)).rejects.toMatchObject({ code: '22023' });
    await db.exec('set role anon');
    await expect(save()).rejects.toMatchObject({ code: '42501' });
  } finally {
    await db.close();
  }
}, 30_000);
