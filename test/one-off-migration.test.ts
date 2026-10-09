import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

const correctionFile = '202610090010_correct_one_off_classification.sql';
const correction = readFileSync(`supabase/migrations/${correctionFile}`, 'utf8');
const league = '00000000-0000-4000-8000-000000000099';
const owner = '10000000-0000-4000-8000-000000000099';

it('corrects title-marked one-offs without changing IDs or payouts, reruns safely, and saves new categories atomically', async () => {
  const db = new PGlite();
  try {
    await db.exec(readFileSync('supabase/tests/bootstrap.sql', 'utf8'));
    for (const file of readdirSync('supabase/migrations').filter(file => file.endsWith('.sql') && file < correctionFile).sort()) {
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    await db.exec(`
      insert into auth.users(id,email) values ('${owner}', 'one-off-owner@example.test');
      insert into public.leagues(id,slug,name) values ('${league}', 'one-off-tests', 'One-off Tests');
      insert into public.league_members(league_id,user_id,role) values ('${league}', '${owner}', 'owner');
      insert into public.players(league_id,id,display_name) values ('${league}', 'alice', 'Alice');
      insert into public.games(league_id,id,title,date,season_id,night_type,format,status,notes) values
        ('${league}','ten','Friday One-off','2026-09-01','fall-2026','10','cash','completed',''),
        ('${league}','twenty','ONE OFF Friday','2026-09-02','fall-2026','20','cash','completed',''),
        ('${league}','other','One-off','2026-09-03','fall-2026','one-off','cash','completed',''),
        ('${league}','explicit','One-off $10','2026-09-04','fall-2026','one-off','cash','completed',''),
        ('${league}','regular','Regular $20 Friday','2026-09-05','fall-2026','20','cash','completed',''),
        ('${league}','metadata','Imported Friday','2026-09-06','fall-2026','20','cash','completed','Excluded from workbook totals');
      insert into public.game_results(league_id,game_id,player_id,buy_in_cents,cash_out_cents,legacy_profit_cents)
        select league_id,id,'alice',5000,3610,100 from public.games where league_id='${league}';
    `);
    const beforeResults = (await db.query('select * from public.game_results order by league_id, game_id, player_id')).rows;
    const unaffectedGames = (await db.query("select * from public.games where league_id <> $1 and title !~* '\\mone[[:space:]‐‑–—-]*offs?\\M' order by league_id,id", [league])).rows;
    await db.exec(correction);
    const games = (await db.query<{ id: string; night_type: string; version: number }>(
      'select id,night_type,version from public.games where league_id=$1 order by id', [league])).rows;
    expect(games).toEqual([
      { id: 'explicit', night_type: 'one-off-10', version: 2 },
      { id: 'metadata', night_type: 'one-off-20', version: 2 },
      { id: 'other', night_type: 'one-off', version: 1 },
      { id: 'regular', night_type: '20', version: 1 },
      { id: 'ten', night_type: 'one-off-10', version: 2 },
      { id: 'twenty', night_type: 'one-off-20', version: 2 },
    ]);
    expect((await db.query('select * from public.game_results order by league_id, game_id, player_id')).rows).toEqual(beforeResults);
    expect((await db.query("select * from public.games where league_id <> $1 and title !~* '\\mone[[:space:]‐‑–—-]*offs?\\M' order by league_id,id", [league])).rows).toEqual(unaffectedGames);
    const historical = (await db.query<{ night_type: string }>("select night_type from public.games where id like '%-one-off-%'")).rows;
    expect(historical).toHaveLength(16);
    expect(historical.filter(game => game.night_type === 'one-off-10')).toHaveLength(10);
    expect(historical.filter(game => game.night_type === 'one-off-20')).toHaveLength(6);
    const audit = (await db.query<{ before_data: unknown; after_data: unknown }>('select before_data,after_data from public.game_audit_log where league_id=$1 order by game_id', [league])).rows;
    expect(audit).toHaveLength(4);
    expect(audit.every(row => row.before_data && row.after_data)).toBe(true);
    const correctedSnapshot = (await db.query('select * from public.games order by league_id,id')).rows;
    await db.exec(correction);
    await db.exec(readFileSync('supabase/migrations/202610090008_classify_historical_stakes.sql', 'utf8'));
    expect((await db.query('select * from public.games order by league_id,id')).rows).toEqual(correctedSnapshot);
    expect((await db.query('select id,night_type,version from public.games where league_id=$1 order by id', [league])).rows).toEqual(games);
    expect((await db.query('select * from public.game_audit_log where league_id=$1', [league])).rows).toHaveLength(4);

    await db.exec(`begin; set local role authenticated;
      select set_config('request.jwt.claims', json_build_object('sub','${owner}','email','one-off-owner@example.test')::text, true);
      select set_config('request.jwt.claim.sub', '${owner}', true);`);
    for (const [nightType, title, expected] of [
      ['one-off-10', '$10 one-off', 'one-off-10'],
      ['one-off-20', '$20 one-off', 'one-off-20'],
      ['20', 'Another One-off Friday', 'one-off-20'],
      ['one-off', '$10 One-off Friday', 'one-off-10'],
      ['10', '$20 One-off Friday', 'one-off-20'],
    ]) {
      const payload = { title, date: '2026-10-09', seasonId: 'fall-2026', nightType, format: 'cash', status: 'draft', notes: '', results: [] };
      const saved = (await db.query<{ game: { id: string; version: number } }>(
        'select public.save_game($1,$2::jsonb) as game', [league, JSON.stringify(payload)])).rows[0].game;
      expect(saved.version).toBe(1);
      expect((await db.query('select night_type from public.games where league_id=$1 and id=$2', [league, saved.id])).rows)
        .toEqual([{ night_type: expected }]);
    }
    await db.exec('rollback');
  } finally { await db.close(); }
}, 30_000);
