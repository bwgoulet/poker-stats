import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('repairs the deployed self-review 403 without migration 006 or resubmitting the request', async () => {
  const db = new PGlite();
  try {
    await db.exec(readFileSync('supabase/tests/bootstrap.sql', 'utf8'));
    for (const migration of ['202610090001_league_game_management.sql', '202610090002_user_profiles_player_links.sql', '202610090003_discord_link_verification.sql']) {
      await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'));
    }
    await db.exec(`
      insert into auth.users(id,email,email_confirmed_at) values
        ('30000000-0000-4000-8000-000000000001','admin@example.test',now());
      update public.users set role='admin' where id='30000000-0000-4000-8000-000000000001';
      insert into public.players(league_id,id,display_name) values
        ('00000000-0000-4000-8000-000000000001','ben','Ben');
      insert into public.player_link_requests(id,league_id,player_id,user_id) values
        ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','ben','30000000-0000-4000-8000-000000000001');
      set role authenticated;
      select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001"}',false);
    `);
    await expect(db.query("select public.review_player_link('40000000-0000-4000-8000-000000000001',true)")).rejects.toThrow('Another administrator must verify your own claim.');
    await db.exec('reset role');
    await db.exec(readFileSync('supabase/migrations/202610090007_player_link_review_contract.sql', 'utf8'));
    await db.exec('set role authenticated');
    // The old portal entry point must also work after applying the repair.
    await db.query("select public.review_player_link('40000000-0000-4000-8000-000000000001',true)");
    expect((await db.query('select player_id,user_id from public.player_links')).rows).toEqual([
      { player_id: 'ben', user_id: '30000000-0000-4000-8000-000000000001' },
    ]);
    expect((await db.query('select status,reviewed_by,reviewed_at is not null as audited from public.player_link_requests')).rows).toEqual([
      { status: 'approved', reviewed_by: '30000000-0000-4000-8000-000000000001', audited: true },
    ]);
    await expect(db.query("select public.review_player_link_v2('40000000-0000-4000-8000-000000000001',true)")).rejects.toThrow('This request has already been reviewed.');
  } finally { await db.close(); }
}, 30000);
