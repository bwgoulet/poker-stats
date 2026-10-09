-- Also runnable against a disposable Supabase database after migrations.
-- Fixture changes are wrapped in a transaction and rolled back at the end.
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
    if sqlstate <> p_code then
      raise exception 'Assertion % expected SQLSTATE %, got %: %', p_name, p_code, sqlstate, sqlerrm;
    end if;
    insert into tests.assertions values (p_name);
    return;
  end;
  raise exception 'Assertion % expected SQLSTATE % but succeeded', p_name, p_code;
end;
$$;
create function tests.game_payload() returns jsonb language sql immutable as $$
  select '{"title":"Friday cash","date":"2026-10-09","seasonId":"fall-2026","nightType":"10","format":"cash","status":"completed","notes":"","results":[{"playerId":"alice","buyInCents":1000,"cashOutCents":2000,"placement":null},{"playerId":"bob","buyInCents":1000,"cashOutCents":0,"placement":null}]}'::jsonb;
$$;
create function tests.login(p_user text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_user = '' then '{}' else
    jsonb_build_object('sub', p_user, 'email', p_user || '@example.test')::text end, true);
  perform set_config('request.jwt.claim.sub', p_user, true);
end;
$$;

insert into auth.users(id, email) values
  ('10000000-0000-4000-8000-000000000001','owner@example.test'),
  ('10000000-0000-4000-8000-000000000002','scorekeeper@example.test'),
  ('10000000-0000-4000-8000-000000000003','viewer@example.test'),
  ('10000000-0000-4000-8000-000000000004','other@example.test'),
  ('10000000-0000-4000-8000-000000000005','admin@example.test');
insert into public.leagues(id, slug, name, visibility) values
  ('00000000-0000-4000-8000-000000000002','private-poker','Private Poker','private'),
  ('00000000-0000-4000-8000-000000000003','other-poker','Other Poker','private');
insert into public.league_members(league_id,user_id,role) values
  ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
  ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','scorekeeper'),
  ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','viewer'),
  ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','admin'),
  ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','owner'),
  ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','owner');
insert into public.players(league_id,id,display_name) values
  ('00000000-0000-4000-8000-000000000001','alice','Alice'),
  ('00000000-0000-4000-8000-000000000001','bob','Bob'),
  ('00000000-0000-4000-8000-000000000002','private-only','Private Player'),
  ('00000000-0000-4000-8000-000000000003','alice','Other Alice');
insert into public.games(league_id,id,title,date,season_id,night_type,format,status,source_ref) values
  ('00000000-0000-4000-8000-000000000001','historical','Historical','2025-09-01','fall-2025','10','cash','completed','workbook:fall-2025/game-1'),
  ('00000000-0000-4000-8000-000000000001','draft-secret','Draft secret','2026-10-09','fall-2026','10','cash','draft',null),
  ('00000000-0000-4000-8000-000000000002','private-game','Private game','2026-10-09','fall-2026','10','cash','completed',null),
  ('00000000-0000-4000-8000-000000000003','historical','Other game','2026-10-09','fall-2026','10','cash','completed',null);
insert into public.game_results(league_id,game_id,player_id,buy_in_cents,cash_out_cents,legacy_profit_cents) values
  ('00000000-0000-4000-8000-000000000001','historical','alice',1000,null,250),
  ('00000000-0000-4000-8000-000000000001','historical','bob',1000,null,-250),
  ('00000000-0000-4000-8000-000000000001','draft-secret','alice',1000,null,null),
  ('00000000-0000-4000-8000-000000000002','private-game','private-only',1000,1000,null),
  ('00000000-0000-4000-8000-000000000003','historical','alice',1000,1000,null);

select tests.login('');
set local role anon;
select tests.assert('anon sees only public leagues', (select count(*) = 1 from public.leagues));
select tests.assert('anon sees only public players', (select count(*) = 2 from public.players));
select tests.assert('anon cannot see public drafts or private games', (select count(*) = 1 from public.games));
select tests.assert('anon cannot see draft results or private results', (select count(*) = 2 from public.game_results));
select tests.assert_raises('anon cannot invoke save RPC', $$select public.save_game('00000000-0000-4000-8000-000000000001', tests.game_payload())$$, '42501');
select tests.assert_raises('anon cannot read membership', $$select * from public.league_members$$, '42501');
select tests.assert_raises('anon cannot call snapshot bypass', $$select public.game_snapshot('00000000-0000-4000-8000-000000000001','draft-secret')$$, '42501');
reset role;

set local role authenticated;
select tests.assert_raises('authenticated null uid cannot save', $$select public.save_game('00000000-0000-4000-8000-000000000001', tests.game_payload())$$, '42501');
select tests.assert_raises('authenticated null uid cannot create league', $$select public.create_league('Bad','bad-league')$$, '42501');
select tests.login('10000000-0000-4000-8000-000000000004');
select tests.assert('outsider sees public plus own private league', (select count(*) = 2 from public.leagues));
select tests.assert('outsider cannot see other private league', not exists(select 1 from public.leagues where slug='private-poker'));
select tests.assert('outsider cannot see another league draft results', not exists(select 1 from public.game_results where game_id='draft-secret'));
select tests.assert_raises('outsider cannot edit UNC', $$select public.save_game('00000000-0000-4000-8000-000000000001', tests.game_payload())$$, '42501');
select tests.assert_raises('authenticated direct table insert revoked', $$insert into public.players(league_id,id,display_name) values ('00000000-0000-4000-8000-000000000003','bad','Bad')$$, '42501');
select tests.assert_raises('authenticated cannot escalate role', $$update public.league_members set role='owner' where user_id=auth.uid()$$, '42501');
select tests.assert_raises('authenticated direct results delete revoked', $$delete from public.game_results$$, '42501');
select tests.assert_raises('authenticated direct game update revoked', $$update public.games set status='completed'$$, '42501');

select tests.login('10000000-0000-4000-8000-000000000003');
select tests.assert('viewer sees public league drafts', exists(select 1 from public.games where id='draft-secret'));
select tests.assert('viewer sees draft results', exists(select 1 from public.game_results where game_id='draft-secret'));
select tests.assert_raises('viewer cannot save', $$select public.save_game('00000000-0000-4000-8000-000000000001', tests.game_payload())$$, '42501');
select tests.assert_raises('viewer cannot delete', $$select public.delete_game('00000000-0000-4000-8000-000000000001','historical',1)$$, '42501');
select tests.assert_raises('viewer cannot create player', $$select public.create_player('00000000-0000-4000-8000-000000000001','New')$$, '42501');

select tests.login('10000000-0000-4000-8000-000000000002');
select tests.assert_raises('scorekeeper cannot update league', $$select public.update_league('00000000-0000-4000-8000-000000000001','Renamed','private')$$, '42501');
select tests.assert_raises('scorekeeper cannot delete league', $$select public.delete_league('00000000-0000-4000-8000-000000000001')$$, '42501');
select tests.assert('scorekeeper can create player', length(public.create_player('00000000-0000-4000-8000-000000000001','Charlie')) = 36);
select tests.assert_raises('duplicate display names rejected', $$select public.create_player('00000000-0000-4000-8000-000000000001',' alice ')$$, '23505');
select set_config('tests.created_game_id', public.save_game('00000000-0000-4000-8000-000000000001',tests.game_payload())->>'id', true);
select tests.assert('save creates game at version one', exists(select 1 from public.games where id=current_setting('tests.created_game_id') and version=1));
select tests.assert('save inserts both result rows', (select count(*)=2 from public.game_results where game_id=current_setting('tests.created_game_id')));
select tests.assert('scorekeeper cannot read actor audit', (select count(*)=0 from public.game_audit_log));

-- Every validation rejection also demonstrates the absence of partial writes.
select tests.assert_raises('reject invalid date', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"date":"2026-02-30"}'::jsonb), '22023');
select tests.assert_raises('reject empty title', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"title":" "}'::jsonb), '22023');
select tests.assert_raises('reject null enum', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"status":null}'::jsonb), '22023');
select tests.assert_raises('reject invalid enum', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"nightType":"30"}'::jsonb), '22023');
select tests.assert_raises('reject invalid season ID', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"seasonId":"fall 2026"}'::jsonb), '22023');
select tests.assert_raises('reject client supplied provenance', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"sourceRef":"fake"}'::jsonb), '22023');
select tests.assert_raises('reject incomplete completed game', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"results":[]}'::jsonb), '22023');
select tests.assert_raises('reject unknown completed payout', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',jsonb_set(tests.game_payload(),'{results,0,cashOutCents}','null')), '22023');
select tests.assert_raises('reject fractional cents', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',jsonb_set(tests.game_payload(),'{results,0,buyInCents}','1.5')), '22023');
select tests.assert_raises('reject negative cents', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',jsonb_set(tests.game_payload(),'{results,0,buyInCents}','-1')), '22023');
select tests.assert_raises('reject overflowing cents', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',jsonb_set(tests.game_payload(),'{results,0,buyInCents}','2147483648')), '22023');
select tests.assert_raises('reject duplicate result player', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',jsonb_set(tests.game_payload(),'{results,1,playerId}','"alice"')), '22023');
select tests.assert_raises('reject cross league player reference', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',jsonb_set(tests.game_payload(),'{results,0,playerId}','"private-only"')), '22023');
select tests.assert_raises('reject legacy result field', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',jsonb_set(tests.game_payload(),'{results,0,legacyProfitCents}','100')), '22023');
select tests.assert_raises('completed tournament requires all placements', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"format":"tournament"}'::jsonb), '22023');
select tests.assert_raises('completed tournament rejects duplicate placement', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',jsonb_set(jsonb_set(tests.game_payload()||'{"format":"tournament"}'::jsonb,'{results,0,placement}','1'),'{results,1,placement}','1')), '22023');
select tests.assert_raises('completed tournament rejects placement gaps', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',jsonb_set(jsonb_set(tests.game_payload()||'{"format":"tournament"}'::jsonb,'{results,0,placement}','1'),'{results,1,placement}','3')), '22023');
select tests.assert('all rejected saves leave record count unchanged', (select count(*)=3 from public.games where league_id='00000000-0000-4000-8000-000000000001'));
select tests.assert('draft allows incomplete results', (public.save_game('00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"status":"draft","results":[]}'::jsonb)->>'version')::integer=1);
select tests.assert('draft tournament permits unique preliminary placement gaps', (public.save_game('00000000-0000-4000-8000-000000000001',jsonb_set(jsonb_set(tests.game_payload()||'{"format":"tournament","status":"draft"}'::jsonb,'{results,0,placement}','100'),'{results,1,placement}','200'))->>'version')::integer=1);
select tests.assert('completed tournament accepts unique explicit placements', (public.save_game('00000000-0000-4000-8000-000000000001',jsonb_set(jsonb_set(tests.game_payload()||'{"format":"tournament"}'::jsonb,'{results,0,placement}','1'),'{results,1,placement}','2'))->>'version')::integer=1);
select tests.assert('save update increments version', (public.save_game('00000000-0000-4000-8000-000000000001', tests.game_payload()||jsonb_build_object('id',current_setting('tests.created_game_id'),'expectedVersion',1,'title','Updated game'))->>'version')::integer=2);
select tests.assert_raises('stale game save rejected', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001', tests.game_payload()||jsonb_build_object('id',current_setting('tests.created_game_id'),'expectedVersion',1)), '40001');
select tests.assert_raises('stale game delete rejected', format('select public.delete_game(%L,%L,1)','00000000-0000-4000-8000-000000000001',current_setting('tests.created_game_id')), '40001');
select tests.assert('stale attempts preserve game and results', exists(select 1 from public.games where id=current_setting('tests.created_game_id') and title='Updated game' and version=2) and (select count(*)=2 from public.game_results where game_id=current_setting('tests.created_game_id')));
select tests.assert_raises('cross league update cannot target another game', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000003',tests.game_payload()||'{"id":"historical","expectedVersion":1}'::jsonb), '42501');

select tests.login('10000000-0000-4000-8000-000000000005');
select tests.assert('admin can save games', (public.save_game('00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"status":"draft","results":[]}'::jsonb)->>'version')::integer=1);
-- Admins can create and edit completed games on either side of the balance.
select set_config('tests.unbalanced_game_id', public.save_game('00000000-0000-4000-8000-000000000001',jsonb_set(tests.game_payload(),'{results,0,cashOutCents}','1900'))->>'id', true);
select tests.assert('admin completes game with lower cash-outs', exists(select 1 from public.games where id=current_setting('tests.unbalanced_game_id') and status='completed' and version=1) and (select sum(buy_in_cents)=2000 and sum(cash_out_cents)=1900 from public.game_results where game_id=current_setting('tests.unbalanced_game_id')));
select tests.assert('admin edits completed game with higher cash-outs', (public.save_game('00000000-0000-4000-8000-000000000001',jsonb_set(tests.game_payload(),'{results,0,cashOutCents}','2100')||jsonb_build_object('id',current_setting('tests.unbalanced_game_id'),'expectedVersion',1))->>'version')::integer=2);
select tests.assert('mismatched payouts are stored unchanged', (select sum(buy_in_cents)=2000 and sum(cash_out_cents)=2100 from public.game_results where game_id=current_setting('tests.unbalanced_game_id')));
select tests.assert('admin completes mismatched tournament', (public.save_game('00000000-0000-4000-8000-000000000001',jsonb_set(jsonb_set(jsonb_set(tests.game_payload()||'{"format":"tournament"}'::jsonb,'{results,0,placement}','1'),'{results,1,placement}','2'),'{results,0,cashOutCents}','0'))->>'version')::integer=1);
select public.update_league('00000000-0000-4000-8000-000000000001','UNC Poker Admin','public');
select tests.assert('admin can update league', exists(select 1 from public.leagues where slug='unc-poker' and name='UNC Poker Admin'));
select tests.assert_raises('admin cannot delete league', $$select public.delete_league('00000000-0000-4000-8000-000000000001')$$, '42501');

select tests.login('10000000-0000-4000-8000-000000000001');
select tests.assert_raises('authorized second league cannot update first league game', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000002',tests.game_payload()||'{"id":"historical","expectedVersion":1,"status":"draft","results":[]}'::jsonb), 'P0002');
select tests.assert_raises('authorized second league cannot delete first league game', $$select public.delete_game('00000000-0000-4000-8000-000000000002','historical',1)$$, 'P0002');
select tests.assert('create audit includes actor snapshot and both results', exists(select 1 from public.game_audit_log where game_id=current_setting('tests.created_game_id') and action='create' and actor_id='10000000-0000-4000-8000-000000000002' and actor_snapshot->>'email' like '%@example.test' and jsonb_array_length(after_data->'results')=2));
select tests.assert('update audit records prior and new versions', exists(select 1 from public.game_audit_log where game_id=current_setting('tests.created_game_id') and action='update' and (before_data->>'version')::integer=1 and (after_data->>'version')::integer=2));
select tests.assert_raises('cannot delete populated league', $$select public.delete_league('00000000-0000-4000-8000-000000000001')$$, '22023');
select public.save_game('00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"id":"historical","expectedVersion":1}'::jsonb);
select tests.assert('reconciling imported game preserves provenance', exists(select 1 from public.games where id='historical' and league_id='00000000-0000-4000-8000-000000000001' and source_ref='workbook:fall-2025/game-1'));
select tests.assert('saving clears imported legacy profit', not exists(select 1 from public.game_results where game_id='historical' and league_id='00000000-0000-4000-8000-000000000001' and legacy_profit_cents is not null));
select public.delete_game('00000000-0000-4000-8000-000000000001',current_setting('tests.created_game_id'),2);
select tests.assert('delete removes game and cascades result rows', not exists(select 1 from public.games where id=current_setting('tests.created_game_id')) and not exists(select 1 from public.game_results where game_id=current_setting('tests.created_game_id')));
select tests.assert('delete audit retains game and result snapshot', exists(select 1 from public.game_audit_log where game_id=current_setting('tests.created_game_id') and action='delete' and jsonb_array_length(before_data->'results')=2 and after_data is null));
select set_config('tests.new_league_id', public.create_league('New league','new-league')::text, true);
select tests.assert('creating league installs authenticated owner', exists(select 1 from public.league_members where league_id=current_setting('tests.new_league_id')::uuid and user_id=auth.uid() and role='owner'));
select tests.assert('new league defaults to private', exists(select 1 from public.leagues where id=current_setting('tests.new_league_id')::uuid and visibility='private'));
select public.update_league(current_setting('tests.new_league_id')::uuid,'Renamed league','public');
select tests.assert('owner can update league', exists(select 1 from public.leagues where id=current_setting('tests.new_league_id')::uuid and name='Renamed league' and visibility='public'));
select public.delete_league(current_setting('tests.new_league_id')::uuid);
select tests.assert('owner can delete empty league', not exists(select 1 from public.leagues where id=current_setting('tests.new_league_id')::uuid));
select tests.assert_raises('invalid visibility rejected', $$select public.create_league('Invalid','invalid-league','everyone')$$, '22023');
select tests.assert_raises('invalid slug rejected', $$select public.create_league('Invalid','Bad slug')$$, '22023');
select public.update_league('00000000-0000-4000-8000-000000000001','UNC Poker','private');
reset role;
set local role anon;
select tests.login('');
select tests.assert('private visibility immediately hides completed games', (select count(*)=0 from public.games));
select tests.assert('private visibility immediately hides all results', (select count(*)=0 from public.game_results));
select tests.assert('private visibility immediately hides all players', (select count(*)=0 from public.players));
reset role;
set local role authenticated;
select tests.login('10000000-0000-4000-8000-000000000001');
select public.update_league('00000000-0000-4000-8000-000000000001','UNC Poker','public');
reset role;

-- Compound FKs protect privileged import operations too.
select tests.assert_raises('FK rejects cross league player even for DB administrator', $$insert into public.game_results(league_id,game_id,player_id,buy_in_cents) values ('00000000-0000-4000-8000-000000000001','draft-secret','private-only',1)$$, '23503');
select tests.assert_raises('FK rejects cross league game even for DB administrator', $$insert into public.game_results(league_id,game_id,player_id,buy_in_cents) values ('00000000-0000-4000-8000-000000000002','draft-secret','private-only',1)$$, '23503');
select tests.assert('same text IDs in different leagues stay isolated', (select title='Other game' from public.games where league_id='00000000-0000-4000-8000-000000000003' and id='historical'));

-- An RPC failure after inserting a game/results must roll the entire write back.
-- This deliberately failing audit trigger proves atomicity beyond input checks.
create function tests.fail_audit() returns trigger language plpgsql as $$
begin raise exception using errcode='P0001', message='Simulated audit failure'; end;
$$;
create trigger fail_audit before insert on public.game_audit_log for each row execute function tests.fail_audit();
set local role authenticated;
select tests.login('10000000-0000-4000-8000-000000000001');
select tests.assert_raises('audit failure atomically rolls back create', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"title":"Must rollback"}'::jsonb), 'P0001');
select tests.assert('failed transaction left no inserted game', not exists(select 1 from public.games where title='Must rollback'));
select tests.assert_raises('audit failure atomically rolls back update', format('select public.save_game(%L,%L::jsonb)','00000000-0000-4000-8000-000000000001',tests.game_payload()||'{"id":"historical","expectedVersion":2,"title":"Must rollback"}'::jsonb), 'P0001');
select tests.assert('failed update retains version and payouts', exists(select 1 from public.games where id='historical' and league_id='00000000-0000-4000-8000-000000000001' and version=2 and title='Friday cash') and (select cash_out_cents=2000 from public.game_results where game_id='historical' and league_id='00000000-0000-4000-8000-000000000001' and player_id='alice'));
select tests.assert_raises('audit failure atomically rolls back delete', $$select public.delete_game('00000000-0000-4000-8000-000000000001','historical',2)$$, 'P0001');
select tests.assert('failed delete restores game and result rows', exists(select 1 from public.games where id='historical' and league_id='00000000-0000-4000-8000-000000000001') and (select count(*)=2 from public.game_results where game_id='historical' and league_id='00000000-0000-4000-8000-000000000001'));
reset role;
drop trigger fail_audit on public.game_audit_log;

update public.league_members set role='viewer' where league_id='00000000-0000-4000-8000-000000000001' and user_id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
select tests.login('10000000-0000-4000-8000-000000000002');
select tests.assert_raises('revoked scorekeeper role immediately blocks save', $$select public.save_game('00000000-0000-4000-8000-000000000001',tests.game_payload())$$, '42501');
reset role;
delete from public.league_members where league_id='00000000-0000-4000-8000-000000000001' and user_id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
select tests.assert('revoked membership immediately hides draft results', not exists(select 1 from public.game_results where game_id='draft-secret'));
reset role;

select count(*)::integer as passed_assertions from tests.assertions;
rollback;
