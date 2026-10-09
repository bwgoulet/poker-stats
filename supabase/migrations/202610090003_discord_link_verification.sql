-- Existing links remain valid. New claims require independent verification.
alter table public.users add column onboarding_choice text check (onboarding_choice in ('no_link', 'link'));
create table public.player_link_requests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  player_id text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  foreign key (league_id,player_id) references public.players(league_id,id) on delete cascade
);
create unique index one_pending_link_per_league on public.player_link_requests(league_id,user_id) where status='pending';
create index player_link_requests_review_idx on public.player_link_requests(league_id,status,created_at);
alter table public.player_link_requests enable row level security;
create policy link_requests_read on public.player_link_requests for select to authenticated using (
  user_id=auth.uid() or public.has_league_role(league_id,array['owner','admin'])
);
revoke all on public.player_link_requests from public, anon, authenticated;
grant select on public.player_link_requests to authenticated;
grant all on public.player_link_requests to service_role;

create function public.set_account_onboarding(p_choice text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in first.'; end if;
  if p_choice not in ('no_link','link') or p_choice is null then raise exception using errcode='22023',message='Choose a player page or no link.'; end if;
  update public.users set onboarding_choice=p_choice where id=auth.uid();
end;
$$;

create or replace function public.claim_player_page(p_league_id uuid,p_player_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception using errcode='42501',message='Sign in with a verified account first.';
  end if;
  perform 1 from public.leagues where id=p_league_id for share;
  if not found or not(public.is_public_league(p_league_id) or public.has_league_role(p_league_id,array['owner','admin','scorekeeper','viewer'])) then
    raise exception using errcode='42501',message='You cannot access this league.';
  end if;
  perform 1 from public.users where id=auth.uid() for update;
  perform 1 from public.players where league_id=p_league_id and id=p_player_id for key share;
  if not found then raise exception using errcode='P0002',message='That player page does not exist.'; end if;
  if exists(select 1 from public.player_links where league_id=p_league_id and (user_id=auth.uid() or player_id=p_player_id)) then
    raise exception using errcode='23505',message='A player page is already linked.';
  end if;
  -- Retrying the same submission is safe. Different selections require review first.
  if exists(select 1 from public.player_link_requests where league_id=p_league_id and user_id=auth.uid() and player_id=p_player_id and status='pending') then return; end if;
  insert into public.player_link_requests(league_id,player_id,user_id) values(p_league_id,p_player_id,auth.uid());
  update public.users set onboarding_choice='link' where id=auth.uid();
end;
$$;

create function public.review_player_link(p_request_id uuid,p_approve boolean)
returns void language plpgsql security definer set search_path='' as $$
declare r public.player_link_requests; v_league uuid;
begin
  select league_id into v_league from public.player_link_requests where id=p_request_id;
  perform 1 from public.leagues where id=v_league for share;
  if not found then raise exception using errcode='P0002',message='Link request not found.'; end if;
  perform public.lock_league_access(v_league,array['owner','admin']);
  select * into r from public.player_link_requests where id=p_request_id for update;
  if not found then raise exception using errcode='P0002',message='Link request not found.'; end if;
  if r.user_id=auth.uid() then raise exception using errcode='42501',message='Another administrator must verify your own claim.'; end if;
  if r.status<>'pending' then raise exception using errcode='40001',message='This request has already been reviewed.'; end if;
  if p_approve is null then raise exception using errcode='22023',message='Choose approve or reject.'; end if;
  perform 1 from public.users where id=r.user_id for update;
  if p_approve then
    insert into public.player_links(league_id,user_id,player_id) values(r.league_id,r.user_id,r.player_id);
  end if;
  update public.player_link_requests set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_at=now(),reviewed_by=auth.uid() where id=r.id;
end;
$$;

-- Only request owners and authorized reviewers can see claimant identities.
create function public.list_player_link_requests()
returns table(id uuid,league_id uuid,league_name text,player_id text,player_name text,user_id uuid,account_name text,discord_id text,status text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select r.id,r.league_id,l.name,r.player_id,p.display_name,r.user_id,u.display_name,(select i.provider_id from auth.identities i where i.user_id=r.user_id and i.provider='discord' order by i.provider_id limit 1),r.status,r.created_at
  from public.player_link_requests r join public.leagues l on l.id=r.league_id
  join public.players p on p.league_id=r.league_id and p.id=r.player_id join public.users u on u.id=r.user_id
  where auth.uid() is not null and (r.user_id=auth.uid() or public.has_league_role(r.league_id,array['owner','admin']))
  order by r.created_at desc,r.id;
$$;
revoke all on function public.set_account_onboarding(text),public.review_player_link(uuid,boolean),public.list_player_link_requests() from public,anon,authenticated;
grant execute on function public.set_account_onboarding(text),public.review_player_link(uuid,boolean),public.list_player_link_requests() to authenticated,service_role;

-- Cancellation preserves request history and cannot race an approval.
create function public.cancel_player_link_request(p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.player_link_requests; v_league uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Sign in first.'; end if;
  select league_id into v_league from public.player_link_requests where id=p_request_id;
  perform 1 from public.leagues where id=v_league for share;
  select * into r from public.player_link_requests where id=p_request_id for update;
  if not found then raise exception using errcode='P0002',message='Request not found.'; end if;
  if r.user_id<>auth.uid() then raise exception using errcode='42501',message='You can only cancel your own request.'; end if;
  if r.status<>'pending' then raise exception using errcode='40001',message='This request is no longer pending.'; end if;
  update public.player_link_requests set status='cancelled' where id=p_request_id;
end;
$$;
revoke all on function public.cancel_player_link_request(uuid) from public,anon,authenticated;
grant execute on function public.cancel_player_link_request(uuid) to authenticated,service_role;

create or replace function public.get_player_link_state(p_league_id uuid, p_player_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_public_league(p_league_id)
    or public.has_league_role(p_league_id, array['owner','admin','scorekeeper','viewer'])) then
    raise exception using errcode = '42501', message = 'You cannot access this league.';
  end if;
  if not exists (select 1 from public.players where league_id = p_league_id and id = p_player_id) then
    raise exception using errcode = 'P0002', message = 'That player page does not exist in this league.';
  end if;
  return jsonb_build_object(
    'requested', exists(select 1 from public.player_link_requests where league_id=p_league_id and player_id=p_player_id and user_id=auth.uid() and status='pending'),
    'linked', exists (select 1 from public.player_links where league_id = p_league_id and player_id = p_player_id),
    'linkedToYou', exists (select 1 from public.player_links where league_id = p_league_id and player_id = p_player_id and user_id = auth.uid()),
    'yourPlayerId', (select player_id from public.player_links where league_id = p_league_id and user_id = auth.uid())
  );
end;
$$;
