begin;
create schema tests;
create table tests.assertions(name text primary key);
grant usage on schema tests to anon, authenticated;
grant select,insert on tests.assertions to anon,authenticated;
create function tests.assert(p_name text,p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'Assertion failed: %',p_name; end if;
  insert into tests.assertions values(p_name);
end;
$$;
create function tests.raises(p_name text,p_sql text,p_code text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlstate<>p_code then raise exception 'Assertion % expected %, got %: %',p_name,p_code,sqlstate,sqlerrm; end if;
    insert into tests.assertions values(p_name); return;
  end;
  raise exception 'Assertion % expected failure',p_name;
end;
$$;
create function tests.login(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',jsonb_build_object('sub',p_user)::text,true);
$$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('30000000-0000-4000-8000-000000000001','player@test.example',now(),'{"full_name":"Discord Player","role":"admin"}'),
 ('30000000-0000-4000-8000-000000000002','owner@test.example',now(),'{}'),
 ('30000000-0000-4000-8000-000000000003','other@test.example',now(),'{}'),
 ('30000000-0000-4000-8000-000000000004','admin@test.example',now(),'{}');
insert into auth.identities(provider_id,user_id,provider) values('123456789012345678','30000000-0000-4000-8000-000000000001','discord');
insert into public.leagues(id,slug,name,visibility) values('00000000-0000-4000-8000-000000000002','secret','Secret','private');
insert into public.players(league_id,id,display_name) values
 ('00000000-0000-4000-8000-000000000001','alice','Alice'),
 ('00000000-0000-4000-8000-000000000001','bob','Bob'),
 ('00000000-0000-4000-8000-000000000001','carol','Carol'),
 ('00000000-0000-4000-8000-000000000002','private','Private');
insert into public.league_members(league_id,user_id,role) values
 ('00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','owner'),
 ('00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004','admin');
insert into public.player_link_requests(id,league_id,player_id,user_id) values('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','private','30000000-0000-4000-8000-000000000003');
set local role authenticated;
select tests.login('30000000-0000-4000-8000-000000000001');
select tests.assert('Discord metadata cannot grant admin', (select role='player' and display_name='Discord Player' from public.users where id=auth.uid()));
select public.set_account_onboarding('no_link');
select tests.assert('no link saved without a player claim',(select onboarding_choice='no_link' from public.users where id=auth.uid()) and not exists(select 1 from public.player_links));
select tests.raises('private league cannot be claimed', $$select public.claim_player_page('00000000-0000-4000-8000-000000000002','private')$$,'42501');
select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice');
select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice');
select tests.assert('claim is pending and retry is idempotent',(select count(*)=1 from public.player_link_requests) and not exists(select 1 from public.player_links));
select tests.assert('request counts as onboarding choice',(select onboarding_choice='link' from public.users where id=auth.uid()));
select tests.raises('claimant cannot approve their own request',format('select public.review_player_link_v2(%L,true)',(select id from public.player_link_requests)),'42501');
select tests.raises('direct links remain denied', $$insert into public.player_links values('00000000-0000-4000-8000-000000000001',auth.uid(),'alice',now())$$,'42501');
select tests.raises('direct request edits remain denied', $$update public.player_link_requests set status='approved'$$,'42501');
select tests.assert('claim does not add membership',not exists(select 1 from public.league_members where user_id=auth.uid()));
select tests.login('90000000-0000-4000-8000-000000000001');
select tests.assert('unrelated account cannot read claims',(select count(*)=0 from public.list_player_link_requests()) and (select count(*)=0 from public.player_link_requests));
select tests.login('30000000-0000-4000-8000-000000000003');
select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice');
select tests.login('30000000-0000-4000-8000-000000000002');
select tests.assert('owner sees only their league pending claims',(select count(*)=2 from public.list_player_link_requests()));
select tests.assert('reviewer sees server-stored Discord identity',(select discord_id='123456789012345678' from public.list_player_link_requests() where user_id='30000000-0000-4000-8000-000000000001'));
select public.review_player_link_v2(id,true) from public.player_link_requests where user_id='30000000-0000-4000-8000-000000000001';
select tests.raises('review is not repeatable',format('select public.review_player_link_v2(%L,true)',(select id from public.player_link_requests where status='approved')),'40001');
select tests.raises('competing claim cannot take verified link',format('select public.review_player_link_v2(%L,true)',(select id from public.player_link_requests where status='pending')),'23505');
select public.review_player_link_v2(id,false) from public.player_link_requests where status='pending';
select tests.raises('league owner cannot review another league', $$select public.review_player_link_v2('40000000-0000-4000-8000-000000000001',true)$$,'42501');
select tests.assert('review retains actor and decision',(select count(*)=2 from public.player_link_requests where reviewed_by=auth.uid() and reviewed_at is not null));
select tests.login('30000000-0000-4000-8000-000000000001');
select tests.assert('approved link visible to claimant',(select player_id='alice' from public.player_links));
select tests.assert('approved link grants no management',not public.has_league_role('00000000-0000-4000-8000-000000000001',array['owner','admin','scorekeeper']));
select public.unlink_player_page('00000000-0000-4000-8000-000000000001','alice');
select tests.assert('unlink keeps player history',exists(select 1 from public.players where id='alice'));
select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice');
select public.cancel_player_link_request(id) from public.player_link_requests where status='pending';
select tests.assert('claimant can cancel pending request',exists(select 1 from public.player_link_requests where status='cancelled'));
select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice');
select tests.assert('cancelled claim can be resubmitted',(select count(*)=1 from public.player_link_requests where status='pending'));
select public.cancel_player_link_request(id) from public.player_link_requests where status='pending';
reset role;
-- League owners/admins can review their own requests with the same audit trail.
set local role authenticated;
select tests.login('30000000-0000-4000-8000-000000000002');
select public.claim_player_page('00000000-0000-4000-8000-000000000001','bob');
select public.review_player_link_v2(id,true) from public.player_link_requests where user_id=auth.uid() and status='pending';
select tests.assert('owner can self approve with audit',exists(select 1 from public.player_links where user_id=auth.uid() and player_id='bob') and exists(select 1 from public.player_link_requests where user_id=auth.uid() and status='approved' and reviewed_by=auth.uid() and reviewed_at is not null));
select tests.login('30000000-0000-4000-8000-000000000004');
select public.claim_player_page('00000000-0000-4000-8000-000000000001','carol');
select public.review_player_link_v2(id,false) from public.player_link_requests where user_id=auth.uid() and status='pending';
select tests.assert('league admin can self reject with audit',not exists(select 1 from public.player_links where user_id=auth.uid()) and exists(select 1 from public.player_link_requests where user_id=auth.uid() and status='rejected' and reviewed_by=auth.uid() and reviewed_at is not null));
select public.claim_player_page('00000000-0000-4000-8000-000000000001','carol');
select public.review_player_link_v2(id,true) from public.player_link_requests where user_id=auth.uid() and status='pending';
select tests.raises('legacy review delegates to current rules',format('select public.review_player_link(%L,true)',(select id from public.player_link_requests where user_id=auth.uid() and status='approved')),'40001');
select tests.assert('league admin can self approve',exists(select 1 from public.player_links where user_id=auth.uid() and player_id='carol'));
select tests.raises('league admin cannot review another league', $$select public.review_player_link_v2('40000000-0000-4000-8000-000000000001',true)$$,'42501');
reset role;
update public.users set role='admin' where id='30000000-0000-4000-8000-000000000003';
set local role authenticated;
select tests.login('30000000-0000-4000-8000-000000000003');
select public.claim_player_page('00000000-0000-4000-8000-000000000001','alice');
select public.review_player_link_v2(id,true) from public.player_link_requests where status='pending' and user_id=auth.uid();
select tests.assert('global admin can self approve across leagues', (select count(*)=2 from public.player_links where user_id=auth.uid()) and (select count(*)=2 from public.player_link_requests where user_id=auth.uid() and status='approved' and reviewed_by=auth.uid() and reviewed_at is not null));
select public.unlink_player_page('00000000-0000-4000-8000-000000000002','private');
select public.claim_player_page('00000000-0000-4000-8000-000000000002','private');
select public.review_player_link_v2(id,false) from public.player_link_requests where status='pending' and user_id=auth.uid();
select tests.assert('global admin can self reject',exists(select 1 from public.player_link_requests where user_id=auth.uid() and league_id='00000000-0000-4000-8000-000000000002' and status='rejected' and reviewed_by=auth.uid()) and not exists(select 1 from public.player_links where league_id='00000000-0000-4000-8000-000000000002'));
select public.claim_player_page('00000000-0000-4000-8000-000000000002','private');
reset role;
update public.users set role='player' where id='30000000-0000-4000-8000-000000000003';
set local role authenticated;
select tests.raises('demoted admin cannot self approve',format('select public.review_player_link_v2(%L,true)',(select id from public.player_link_requests where user_id=auth.uid() and status='pending')),'42501');
reset role;
set local role anon;
select tests.raises('anonymous request reader denied','select public.list_player_link_requests()','42501');
select tests.raises('anonymous review denied', $$select public.review_player_link_v2('00000000-0000-4000-8000-000000000001',true)$$,'42501');
reset role;
select count(*)::integer as passed_assertions from tests.assertions;
rollback;
