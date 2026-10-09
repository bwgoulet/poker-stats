-- Fixtures run as the SQL administrator; caller assertions use actual JWT/RLS.
begin;
create schema tests;
create table tests.assertions(name text primary key);
grant usage on schema tests to anon, authenticated;
grant select, insert on tests.assertions to anon, authenticated;
create function tests.assert(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'Assertion failed: %', p_name; end if;
  insert into tests.assertions values (p_name);
end;
$$;
create function tests.assert_raises(p_name text, p_sql text, p_code text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate <> p_code then raise exception 'Assertion % expected %, got %: %', p_name, p_code, sqlstate, sqlerrm; end if;
    insert into tests.assertions values (p_name);
    return;
  end;
  raise exception 'Assertion % expected % but succeeded', p_name, p_code;
end;
$$;
create function tests.login(p_user text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_user = '' then '{}' else
    jsonb_build_object('sub', p_user, 'email', p_user || '@example.test')::text end, true);
end;
$$;
create function tests.game_payload() returns jsonb language sql immutable as $$
  select '{"title":"Account admin game","date":"2026-10-09","seasonId":"fall-2026","nightType":"10","format":"cash","status":"completed","notes":"","results":[{"playerId":"alice","buyInCents":1000,"cashOutCents":2000,"placement":null},{"playerId":"bob","buyInCents":1000,"cashOutCents":0,"placement":null}]}'::jsonb;
$$;

select tests.assert('legacy auth profile backfilled safely', exists (select 1 from public.users
  where id='90000000-0000-4000-8000-000000000001' and email='legacy@example.test' and display_name='Legacy Player' and role='player'));
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
  ('20000000-0000-4000-8000-000000000001','alpha@example.test','{"display_name":"  Alpha  ","role":"admin"}', now()),
  ('20000000-0000-4000-8000-000000000002','beta@example.test','{}',now()),
  ('20000000-0000-4000-8000-000000000003','unconfirmed@example.test','{"display_name":""}',null),
  ('20000000-0000-4000-8000-000000000004','owner@example.test','{}',now());
select tests.assert('signup trigger creates every profile', (select count(*)=4 from public.users where id::text like '20000000%'));
select tests.assert('metadata cannot promote account', (select role='player' and display_name='Alpha' from public.users where email='alpha@example.test'));
select tests.assert('empty metadata gets valid default name', (select display_name='Poker player' from public.users where email='unconfirmed@example.test'));
update auth.users set email='alpha-updated@example.test' where id='20000000-0000-4000-8000-000000000001';
select tests.assert('email update syncs profile without changing role', (select email='alpha-updated@example.test' and role='player' from public.users where id='20000000-0000-4000-8000-000000000001'));
select tests.assert_raises('unknown account roles rejected', $$update public.users set role='owner' where email='beta@example.test'$$, '23514');

insert into public.leagues(id,slug,name,visibility) values
  ('00000000-0000-4000-8000-000000000002','second-public','Second Public','public'),
  ('00000000-0000-4000-8000-000000000003','account-private','Account Private','private');
insert into public.league_members values
  ('00000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004','owner',now());
insert into public.players(league_id,id,display_name) values
  ('00000000-0000-4000-8000-000000000001','alice','Alice'),
  ('00000000-0000-4000-8000-000000000001','bob','Bob'),
  ('00000000-0000-4000-8000-000000000002','alice','Other Alice'),
  ('00000000-0000-4000-8000-000000000003','alice','Private Alice'),
  ('00000000-0000-4000-8000-000000000003','bob','Private Bob'),
  ('00000000-0000-4000-8000-000000000003','private-only','Private Only');
insert into public.games(league_id,id,title,date,season_id,night_type,format,status) values
  ('00000000-0000-4000-8000-000000000001','history','Historical','2026-10-09','fall-2026','10','cash','completed'),
  ('00000000-0000-4000-8000-000000000003','secret','Draft secret','2026-10-09','fall-2026','10','cash','draft');
insert into public.game_results(league_id,game_id,player_id,buy_in_cents,cash_out_cents) values
  ('00000000-0000-4000-8000-000000000001','history','alice',1000,2000),
  ('00000000-0000-4000-8000-000000000001','history','bob',1000,0);

select tests.login('');
set local role anon;
select tests.assert_raises('anon cannot read account emails', $$select * from public.users$$, '42501');
select tests.assert_raises('anon cannot read player ownership table', $$select * from public.player_links$$, '42501');
select tests.assert_raises('anon cannot claim page', $$select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice')$$, '42501');
select tests.assert('public claim status exposes no identity', public.get_player_link_state('00000000-0000-4000-8000-000000000001','alice') = '{"linked":false,"linkedToYou":false,"yourPlayerId":null}'::jsonb);
select tests.assert_raises('public status cannot expose private roster', $$select public.get_player_link_state('00000000-0000-4000-8000-000000000003','alice')$$, '42501');
reset role;

set local role authenticated;
select tests.assert('null uid cannot read any profiles', (select count(*)=0 from public.users));
select tests.assert_raises('null uid cannot unlink', $$select public.unlink_player_page('00000000-0000-4000-8000-000000000001','alice')$$, '42501');
select tests.login('20000000-0000-4000-8000-000000000001');
select tests.assert('account can read only own profile', (select count(*)=1 from public.users) and (select email='alpha-updated@example.test' from public.users));
select tests.assert_raises('cannot self promote role', $$update public.users set role='admin' where id=auth.uid()$$, '42501');
select tests.assert_raises('cannot insert arbitrary profiles', $$insert into public.users(id,email,display_name,role) values (gen_random_uuid(),'bad@example.test','Bad','admin')$$, '42501');
select tests.assert_raises('cannot delete account profile', $$delete from public.users where id=auth.uid()$$, '42501');
select tests.assert_raises('cannot invoke profile trigger directly', $$select public.sync_auth_user_profile()$$, '42501');
select tests.assert_raises('cannot invoke permission lock helper', $$select public.lock_league_access('00000000-0000-4000-8000-000000000001',array['admin'])$$, '42501');
select tests.assert_raises('player cannot add games', $$select public.save_game('00000000-0000-4000-8000-000000000001',tests.game_payload())$$, '42501');
select tests.assert_raises('player cannot claim inaccessible league', $$select public.claim_player_page('00000000-0000-4000-8000-000000000003','alice')$$, '42501');
select tests.assert_raises('claim rejects player from another league', $$select public.claim_player_page('00000000-0000-4000-8000-000000000001','private-only')$$, 'P0002');
select tests.assert_raises('direct claim writes denied', $$insert into public.player_links values ('00000000-0000-4000-8000-000000000001',auth.uid(),'alice',now())$$, '42501');
select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice');
select tests.assert('own player claim recorded', (select count(*)=1 from public.player_links) and (select player_id='alice' and user_id=auth.uid() from public.player_links));
select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice');
select tests.assert('duplicate own claim is idempotent', (select count(*)=1 from public.player_links));
select tests.assert('own claim status returned', public.get_player_link_state('00000000-0000-4000-8000-000000000001','alice') = '{"linked":true,"linkedToYou":true,"yourPlayerId":"alice"}'::jsonb);
select tests.assert('other page identifies existing own link', public.get_player_link_state('00000000-0000-4000-8000-000000000001','bob')->>'yourPlayerId'='alice');
select tests.assert_raises('one player page per account per league', $$select public.claim_player_page('00000000-0000-4000-8000-000000000001','bob')$$, '23505');
select public.claim_player_page('00000000-0000-4000-8000-000000000002','alice');
select tests.assert('same account can link another league', (select count(*)=2 from public.player_links));
select tests.assert_raises('claim does not grant editor access', $$select public.create_player('00000000-0000-4000-8000-000000000001','Forbidden')$$, '42501');
select tests.assert('claim does not create membership', (select count(*)=0 from public.league_members where user_id=auth.uid()));
select tests.assert('claim preserves results and game versions', (select sum(cash_out_cents)=2000 from public.game_results where game_id='history') and (select version=1 from public.games where id='history'));

select tests.login('20000000-0000-4000-8000-000000000002');
select tests.assert('other accounts cannot read claim identities', (select count(*)=0 from public.player_links));
select tests.assert('status never returns other account id', public.get_player_link_state('00000000-0000-4000-8000-000000000001','alice') = '{"linked":true,"linkedToYou":false,"yourPlayerId":null}'::jsonb);
select tests.assert_raises('another account cannot take claimed page', $$select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice')$$, '23505');
select tests.assert_raises('another account cannot unlink claimed page', $$select public.unlink_player_page('00000000-0000-4000-8000-000000000001','alice')$$, '42501');
select tests.assert_raises('direct link update denied', $$update public.player_links set user_id=auth.uid()$$, '42501');
select tests.assert_raises('direct link delete denied', $$delete from public.player_links$$, '42501');
select public.claim_player_page('00000000-0000-4000-8000-000000000001','bob');
select tests.assert('other account may claim different unclaimed page', (select player_id='bob' from public.player_links));

select tests.login('20000000-0000-4000-8000-000000000003');
select tests.assert_raises('unconfirmed email cannot claim', $$select public.claim_player_page('00000000-0000-4000-8000-000000000002','alice')$$, '42501');
reset role;
update auth.users set email_confirmed_at=now() where id='20000000-0000-4000-8000-000000000003';
set local role authenticated;
select tests.assert_raises('confirmation alone does not grant private access', $$select public.claim_player_page('00000000-0000-4000-8000-000000000003','alice')$$, '42501');

select tests.login('20000000-0000-4000-8000-000000000004');
select public.claim_player_page('00000000-0000-4000-8000-000000000003','alice');
select tests.assert('private league member can claim own page', (select player_id='alice' from public.player_links));
select public.create_player('00000000-0000-4000-8000-000000000003','League role still works');
select tests.assert('player profile preserves explicit owner rights', public.has_league_role('00000000-0000-4000-8000-000000000003',array['owner']));
reset role;

-- Manual first-admin promotion must be enough without league_members rows.
update public.users set role='admin' where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select tests.login('20000000-0000-4000-8000-000000000001');
select tests.assert('promoted admin sees every league', (select count(*)=3 from public.leagues));
select tests.assert('promoted admin sees private drafts', exists (select 1 from public.games where id='secret'));
select tests.assert('app admin receives admin game permission', public.has_league_role('00000000-0000-4000-8000-000000000003',array['admin']));
select tests.assert('app admin does not receive owner permission', not public.has_league_role('00000000-0000-4000-8000-000000000003',array['owner']));
select tests.assert('app admin cannot authorize nonexistent leagues', not public.has_league_role('00000000-0000-4000-8000-000000000099',array['admin']));
select public.create_player('00000000-0000-4000-8000-000000000003','Global admin player');
select public.update_league('00000000-0000-4000-8000-000000000003','Renamed by admin','private');
select tests.assert('app admin can rename private league', exists (select 1 from public.leagues where name='Renamed by admin'));
select public.save_game('00000000-0000-4000-8000-000000000003',tests.game_payload());
select tests.assert('app admin can save private completed game', exists (select 1 from public.games where title='Account admin game' and version=1));
select public.save_game('00000000-0000-4000-8000-000000000003', tests.game_payload() ||
  (select jsonb_build_object('id',id,'expectedVersion',version,'title','Edited by admin') from public.games where title='Account admin game'));
select tests.assert('app admin can update game with version check', exists (select 1 from public.games where title='Edited by admin' and version=2));
select tests.assert_raises('app admin still must supply current version', format('select public.delete_game(%L,%L,1)','00000000-0000-4000-8000-000000000003', (select id from public.games where title='Edited by admin')), '40001');
select public.delete_game('00000000-0000-4000-8000-000000000003',id,version) from public.games where title='Edited by admin';
select tests.assert('app admin deletion keeps complete audit trail', (select count(*)=3 from public.game_audit_log where actor_id=auth.uid()));
select tests.assert_raises('app admin cannot delete another owners league', $$select public.delete_league('00000000-0000-4000-8000-000000000003')$$, '42501');
select tests.assert_raises('app admin cannot directly rewrite other profiles', $$update public.users set role='admin' where email='beta@example.test'$$, '42501');
select tests.assert_raises('app admin cannot bypass game RPC', $$delete from public.games where id='secret'$$, '42501');
reset role;
update public.users set role='player' where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select tests.assert('demotion immediately hides private league', not exists (select 1 from public.leagues where id='00000000-0000-4000-8000-000000000003'));
select tests.assert_raises('demotion immediately revokes game mutation', $$select public.save_game('00000000-0000-4000-8000-000000000003',tests.game_payload())$$, '42501');
select public.unlink_player_page('00000000-0000-4000-8000-000000000001','alice');
select public.unlink_player_page('00000000-0000-4000-8000-000000000001','alice');
select tests.assert('unlink is idempotent and keeps other league link', (select count(*)=1 from public.player_links) and (select league_id='00000000-0000-4000-8000-000000000002' from public.player_links));
select tests.assert('unlink preserves historical player and results', exists (select 1 from public.players where league_id='00000000-0000-4000-8000-000000000001' and id='alice') and (select count(*)=2 from public.game_results where game_id='history'));
reset role;
update public.leagues set visibility='private' where id='00000000-0000-4000-8000-000000000002';
set local role authenticated;
select tests.assert('own links readable after losing league access', (select count(*)=1 from public.player_links));
select public.unlink_player_page('00000000-0000-4000-8000-000000000002','alice');
select tests.assert('own link removable after league becomes private', (select count(*)=0 from public.player_links));
select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice');
reset role;

select tests.assert_raises('composite link FK rejects wrong league player', $$insert into public.player_links(league_id,user_id,player_id) values ('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','private-only')$$, '23503');
select tests.assert_raises('unique account league rejects bypassed second claim', $$insert into public.player_links(league_id,user_id,player_id) values ('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','bob')$$, '23505');
select tests.assert_raises('unique page rejects bypassed account takeover', $$insert into public.player_links(league_id,user_id,player_id) values ('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','alice')$$, '23505');
update public.player_links set user_id='20000000-0000-4000-8000-000000000003'
  where league_id='00000000-0000-4000-8000-000000000001' and player_id='alice';
select tests.assert('privileged admin can repair mistaken ownership', exists (select 1 from public.player_links where player_id='alice' and league_id='00000000-0000-4000-8000-000000000001' and user_id='20000000-0000-4000-8000-000000000003'));
delete from auth.users where id='20000000-0000-4000-8000-000000000003';
select tests.assert('auth deletion cascades account and its links', not exists (select 1 from public.users where id='20000000-0000-4000-8000-000000000003') and not exists (select 1 from public.player_links where user_id='20000000-0000-4000-8000-000000000003'));
select tests.assert('account deletion does not delete poker history', exists (select 1 from public.players where id='alice' and league_id='00000000-0000-4000-8000-000000000001') and (select count(*)=2 from public.game_results where game_id='history'));
select count(*)::integer as passed_assertions from tests.assertions;
rollback;
