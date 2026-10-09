-- Account identities are separate from historical poker player records.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only the Auth service creates profiles. User-controlled metadata never sets
-- permissions. Existing Auth accounts are backfilled with the same safe default.
create function public.sync_auth_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users(id, email, display_name, role)
  values (new.id, new.email, coalesce(nullif(left(btrim(new.raw_user_meta_data->>'display_name'), 100), ''),
    nullif(left(btrim(new.raw_user_meta_data->>'full_name'), 100), ''), 'Poker player'), 'player')
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;
create trigger on_auth_user_profile after insert or update of email on auth.users
  for each row execute function public.sync_auth_user_profile();

insert into public.users(id, email, display_name, role)
select id, email, coalesce(nullif(left(btrim(raw_user_meta_data->>'display_name'), 100), ''),
  nullif(left(btrim(raw_user_meta_data->>'full_name'), 100), ''), 'Poker player'), 'player'
from auth.users
on conflict (id) do nothing;

create function public.touch_user_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger on_user_profile_update before update on public.users
  for each row execute function public.touch_user_profile();

alter table public.users enable row level security;
create policy users_read_self on public.users for select to authenticated using (id = auth.uid());
revoke all on public.users from public, anon, authenticated;
grant select on public.users to authenticated;
grant all on public.users to service_role;
revoke all on function public.sync_auth_user_profile(), public.touch_user_profile() from public, anon, authenticated;

-- An app admin can administer games in every league. Owner-only operations
-- (league deletion) still require an explicit owner membership.
create or replace function public.has_league_role(p_league_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.league_members m
      where m.league_id = p_league_id and m.user_id = auth.uid() and m.role = any(p_roles))
    or ('admin' = any(p_roles)
      and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
      and exists (select 1 from public.leagues l where l.id = p_league_id))
  );
$$;

-- Internal helper: callers lock the league first, then hold the relevant role
-- row through commit, so revocation cannot race an authorized mutation.
create function public.lock_league_access(p_league_id uuid, p_roles text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if 'admin' = any(p_roles) then
    perform 1 from public.users where id = auth.uid() and role = 'admin' for share;
    if found then return; end if;
  end if;
  perform 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid() and role = any(p_roles) for share;
  if not found then
    raise exception using errcode = '42501', message = 'Your role has changed. Reload and try again.';
  end if;
end;
$$;
revoke all on function public.lock_league_access(uuid,text[]) from public, anon, authenticated;

create table public.player_links (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  player_id text not null,
  created_at timestamptz not null default now(),
  primary key (league_id, user_id),
  unique (league_id, player_id),
  foreign key (league_id, player_id) references public.players(league_id, id) on delete cascade
);
create index player_links_user_idx on public.player_links(user_id, league_id);
alter table public.player_links enable row level security;
create policy player_links_read_self on public.player_links for select to authenticated using (user_id = auth.uid());
revoke all on public.player_links from public, anon, authenticated;
grant select on public.player_links to authenticated;
grant all on public.player_links to service_role;

create function public.claim_player_page(p_league_id uuid, p_player_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sign in to link a player page.';
  end if;
  if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then
    raise exception using errcode = '42501', message = 'Confirm your email before linking a player page.';
  end if;
  -- Share lock prevents a concurrent public-to-private change during a claim.
  perform 1 from public.leagues where id = p_league_id for share;
  if not found or not (public.is_public_league(p_league_id)
    or public.has_league_role(p_league_id, array['owner','admin','scorekeeper','viewer'])) then
    raise exception using errcode = '42501', message = 'You cannot access this league.';
  end if;
  perform 1 from public.users where id = auth.uid() for update;
  if not found then raise exception using errcode = '42501', message = 'Your account profile is unavailable.'; end if;
  perform 1 from public.players where league_id = p_league_id and id = p_player_id for key share;
  if not found then raise exception using errcode = 'P0002', message = 'That player page does not exist in this league.'; end if;
  select player_id into v_current from public.player_links where league_id = p_league_id and user_id = auth.uid();
  if v_current = p_player_id then return; end if;
  if v_current is not null then
    raise exception using errcode = '23505', message = 'Unlink your current player page in this league before choosing another.';
  end if;
  if exists (select 1 from public.player_links where league_id = p_league_id and player_id = p_player_id) then
    raise exception using errcode = '23505', message = 'That player page is already linked to another account.';
  end if;
  insert into public.player_links(league_id, user_id, player_id) values (p_league_id, auth.uid(), p_player_id);
end;
$$;

create function public.unlink_player_page(p_league_id uuid, p_player_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in to unlink a player page.'; end if;
  -- Users may release their own link even if the league has become private.
  perform 1 from public.leagues where id = p_league_id for key share;
  perform 1 from public.users where id = auth.uid() for update;
  if exists (select 1 from public.player_links where league_id = p_league_id and player_id = p_player_id and user_id <> auth.uid()) then
    raise exception using errcode = '42501', message = 'You can only unlink your own player page.';
  end if;
  delete from public.player_links where league_id = p_league_id and player_id = p_player_id and user_id = auth.uid();
end;
$$;

-- Public claim status contains no account IDs, names, or email addresses.
create function public.get_player_link_state(p_league_id uuid, p_player_id text)
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
    'linked', exists (select 1 from public.player_links where league_id = p_league_id and player_id = p_player_id),
    'linkedToYou', exists (select 1 from public.player_links where league_id = p_league_id and player_id = p_player_id and user_id = auth.uid()),
    'yourPlayerId', (select player_id from public.player_links where league_id = p_league_id and user_id = auth.uid())
  );
end;
$$;
revoke all on function public.claim_player_page(uuid,text), public.unlink_player_page(uuid,text),
  public.get_player_link_state(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_player_page(uuid,text), public.unlink_player_page(uuid,text) to authenticated;
grant execute on function public.get_player_link_state(uuid,text) to anon, authenticated;
grant execute on function public.claim_player_page(uuid,text), public.unlink_player_page(uuid,text),
  public.get_player_link_state(uuid,text) to service_role;

-- Replaced mutation RPCs below preserve validation, versions, and audit history,
-- and accept either the locked app admin profile or an existing league role.

create or replace function public.save_game(p_league_id uuid, p_game jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id text;
  v_version integer;
  v_expected integer;
  v_date date;
  v_result jsonb;
  v_player_id text;
  v_player_ids text[] := '{}';
  v_placements integer[] := '{}';
  v_buy_in integer;
  v_cash_out integer;
  v_placement integer;
  v_buy_total bigint := 0;
  v_cash_total bigint := 0;
  v_missing_cash boolean := false;
  v_before jsonb;
  v_after jsonb;
  v_action text;
begin
  if not public.has_league_role(p_league_id, array['owner','admin','scorekeeper']) then
    raise exception using errcode = '42501', message = 'You do not have permission to edit games in this league.';
  end if;
  -- Lock league before membership throughout the RPCs so deletion and creation
  -- use one lock order. Key-share permits unrelated game writes in parallel.
  perform 1 from public.leagues where id = p_league_id for key share;
  perform public.lock_league_access(p_league_id, array['owner','admin','scorekeeper']);
  if p_game is null or jsonb_typeof(p_game) <> 'object' then
    raise exception using errcode = '22023', message = 'Game must be an object.';
  end if;
  if exists(select 1 from jsonb_object_keys(p_game) k where k not in
    ('id','expectedVersion','title','date','seasonId','nightType','format','status','notes','results')) then
    raise exception using errcode = '22023', message = 'Game contains an unsupported field.';
  end if;
  if jsonb_typeof(p_game->'title') is distinct from 'string' or length(btrim(p_game->>'title')) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'Title must contain 1 to 120 characters.';
  end if;
  if jsonb_typeof(p_game->'date') is distinct from 'string' or (p_game->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception using errcode = '22023', message = 'Date must be a valid YYYY-MM-DD date.';
  end if;
  begin
    v_date := (p_game->>'date')::date;
  exception when datetime_field_overflow or invalid_datetime_format then
    raise exception using errcode = '22023', message = 'Date must be a valid YYYY-MM-DD date.';
  end;
  if v_date not between date '1900-01-01' and date '2100-12-31' then
    raise exception using errcode = '22023', message = 'Date must be between 1900 and 2100.';
  end if;
  if jsonb_typeof(p_game->'seasonId') is distinct from 'string' or ((p_game->>'seasonId') !~ '^[a-z][a-z0-9-]*-\d{4}$' or length(p_game->>'seasonId') > 80) then
    raise exception using errcode = '22023', message = 'Season ID must use lowercase letters, numbers and hyphens and end in a four-digit year (maximum 80 characters).';
  end if;
  if jsonb_typeof(p_game->'nightType') is distinct from 'string' or (p_game->>'nightType') not in ('10','20','50','online','one-off')
    or jsonb_typeof(p_game->'format') is distinct from 'string' or (p_game->>'format') not in ('cash','tournament')
    or jsonb_typeof(p_game->'status') is distinct from 'string' or (p_game->>'status') not in ('draft','completed') then
    raise exception using errcode = '22023', message = 'Game type, format or status is invalid.';
  end if;
  if jsonb_typeof(p_game->'notes') is distinct from 'string' or length(p_game->>'notes') > 2000 then
    raise exception using errcode = '22023', message = 'Notes must be text of at most 2000 characters.';
  end if;
  if jsonb_typeof(p_game->'results') is distinct from 'array' or jsonb_array_length(p_game->'results') > 500 then
    raise exception using errcode = '22023', message = 'Results must be an array of at most 500 players.';
  end if;

  for v_result in select value from jsonb_array_elements(p_game->'results') loop
    if jsonb_typeof(v_result) <> 'object' or exists(select 1 from jsonb_object_keys(v_result) k
      where k not in ('playerId','buyInCents','cashOutCents','placement')) then
      raise exception using errcode = '22023', message = 'Result contains an unsupported field.';
    end if;
    if jsonb_typeof(v_result->'playerId') is distinct from 'string' then
      raise exception using errcode = '22023', message = 'Each result needs a player ID.';
    end if;
    v_player_id := v_result->>'playerId';
    if v_player_id = any(v_player_ids) then
      raise exception using errcode = '22023', message = 'Each player may appear only once in a game.';
    end if;
    if not exists(select 1 from public.players where league_id = p_league_id and id = v_player_id) then
      raise exception using errcode = '22023', message = 'Every player must belong to this league.';
    end if;
    v_player_ids := array_append(v_player_ids, v_player_id);
    if jsonb_typeof(v_result->'buyInCents') is distinct from 'number' then
      raise exception using errcode = '22023', message = 'Buy-in must be an integer number of cents.';
    end if;
    if (v_result->>'buyInCents')::numeric not between 0 and 100000000
      or (v_result->>'buyInCents')::numeric <> trunc((v_result->>'buyInCents')::numeric) then
      raise exception using errcode = '22023', message = 'Buy-in must be an integer between 0 and 100000000 cents.';
    end if;
    v_buy_in := (v_result->>'buyInCents')::numeric::integer;
    if not (v_result ? 'cashOutCents') or jsonb_typeof(v_result->'cashOutCents') not in ('number','null') then
      raise exception using errcode = '22023', message = 'Cash-out must be integer cents or null.';
    end if;
    v_cash_out := null;
    if jsonb_typeof(v_result->'cashOutCents') = 'number' then
      if (v_result->>'cashOutCents')::numeric not between 0 and 100000000
        or (v_result->>'cashOutCents')::numeric <> trunc((v_result->>'cashOutCents')::numeric) then
        raise exception using errcode = '22023', message = 'Cash-out must be an integer between 0 and 100000000 cents.';
      end if;
      v_cash_out := (v_result->>'cashOutCents')::numeric::integer;
    else
      v_missing_cash := true;
    end if;
    if not (v_result ? 'placement') or jsonb_typeof(v_result->'placement') not in ('number','null') then
      raise exception using errcode = '22023', message = 'Placement must be a positive integer or null.';
    end if;
    v_placement := null;
    if jsonb_typeof(v_result->'placement') = 'number' then
      if (v_result->>'placement')::numeric not between 1 and 500
        or (v_result->>'placement')::numeric <> trunc((v_result->>'placement')::numeric) then
        raise exception using errcode = '22023', message = 'Placement must be an integer between 1 and 500.';
      end if;
      v_placement := (v_result->>'placement')::numeric::integer;
      if p_game->>'format' = 'tournament' and p_game->>'status' = 'completed'
        and v_placement > jsonb_array_length(p_game->'results') then
        raise exception using errcode = '22023', message = 'Completed tournament placements must cover 1 through the player count.';
      end if;
      if p_game->>'format' = 'tournament' and v_placement = any(v_placements) then
        raise exception using errcode = '22023', message = 'Tournament placements must be unique.';
      end if;
      v_placements := array_append(v_placements, v_placement);
    elsif p_game->>'status' = 'completed' and p_game->>'format' = 'tournament' then
      raise exception using errcode = '22023', message = 'Completed tournaments need a placement for every player.';
    end if;
    v_buy_total := v_buy_total + v_buy_in;
    v_cash_total := v_cash_total + coalesce(v_cash_out, 0);
  end loop;
  if p_game->>'status' = 'completed' and (
    jsonb_array_length(p_game->'results') < 2 or v_missing_cash or v_buy_total <= 0 or v_buy_total <> v_cash_total
  ) then
    raise exception using errcode = '22023', message = 'Completed games need at least two players, known cash-outs, and positive balanced totals.';
  end if;

  if p_game ? 'id' then
    if jsonb_typeof(p_game->'id') is distinct from 'string' or length(p_game->>'id') not between 1 and 180
      or (p_game->>'id') !~ '^[A-Za-z0-9_-]+$' then
      raise exception using errcode = '22023', message = 'Game ID is invalid.';
    end if;
    if jsonb_typeof(p_game->'expectedVersion') is distinct from 'number' then
      raise exception using errcode = '22023', message = 'An update requires expectedVersion.';
    end if;
    if (p_game->>'expectedVersion')::numeric not between 1 and 2147483646
      or (p_game->>'expectedVersion')::numeric <> trunc((p_game->>'expectedVersion')::numeric) then
      raise exception using errcode = '22023', message = 'Expected version must be a positive integer.';
    end if;
    v_expected := (p_game->>'expectedVersion')::numeric::integer;
    v_id := p_game->>'id';
    select version into v_version from public.games where league_id = p_league_id and id = v_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Game does not exist in this league.';
    end if;
    if v_version <> v_expected then
      raise exception using errcode = '40001', message = 'This game changed since you opened it. Reload before saving.';
    end if;
    v_before := public.game_snapshot(p_league_id, v_id);
    v_version := v_version + 1;
    update public.games set title = btrim(p_game->>'title'), date = v_date,
      season_id = p_game->>'seasonId', night_type = p_game->>'nightType', format = p_game->>'format',
      status = p_game->>'status', notes = p_game->>'notes', version = v_version, updated_at = now()
    where league_id = p_league_id and id = v_id;
    delete from public.game_results where league_id = p_league_id and game_id = v_id;
    v_action := 'update';
  else
    if p_game ? 'expectedVersion' then
      raise exception using errcode = '22023', message = 'New games must not supply expectedVersion.';
    end if;
    v_id := gen_random_uuid()::text;
    v_version := 1;
    insert into public.games(league_id, id, title, date, season_id, night_type, format, status, notes)
    values (p_league_id, v_id, btrim(p_game->>'title'), v_date, p_game->>'seasonId', p_game->>'nightType',
      p_game->>'format', p_game->>'status', p_game->>'notes');
    v_action := 'create';
  end if;
  insert into public.game_results(league_id, game_id, player_id, buy_in_cents, cash_out_cents, placement)
  select p_league_id, v_id, value->>'playerId', (value->>'buyInCents')::numeric::integer,
    (value->>'cashOutCents')::numeric::integer, (value->>'placement')::numeric::integer
  from jsonb_array_elements(p_game->'results');
  v_after := public.game_snapshot(p_league_id, v_id);
  insert into public.game_audit_log(league_id, game_id, action, actor_id, actor_snapshot, before_data, after_data)
  values (p_league_id, v_id, v_action, auth.uid(),
    jsonb_build_object('id', auth.uid(), 'email', auth.jwt()->>'email'), v_before, v_after);
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create or replace function public.delete_game(p_league_id uuid, p_game_id text, p_expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_version integer; v_before jsonb;
begin
  if not public.has_league_role(p_league_id, array['owner','admin','scorekeeper']) then
    raise exception using errcode = '42501', message = 'You do not have permission to delete games in this league.';
  end if;
  perform 1 from public.leagues where id = p_league_id for key share;
  perform public.lock_league_access(p_league_id, array['owner','admin','scorekeeper']);
  if p_game_id is null or length(p_game_id) not between 1 and 180 or p_game_id !~ '^[A-Za-z0-9_-]+$'
    or p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'Game ID and a positive expected version are required.';
  end if;
  select version into v_version from public.games where league_id = p_league_id and id = p_game_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Game does not exist in this league.'; end if;
  if v_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'This game changed since you opened it. Reload before deleting.';
  end if;
  v_before := public.game_snapshot(p_league_id, p_game_id);
  delete from public.games where league_id = p_league_id and id = p_game_id;
  insert into public.game_audit_log(league_id, game_id, action, actor_id, actor_snapshot, before_data)
  values (p_league_id, p_game_id, 'delete', auth.uid(),
    jsonb_build_object('id', auth.uid(), 'email', auth.jwt()->>'email'), v_before);
end;
$$;

create or replace function public.update_league(p_league_id uuid, p_name text, p_visibility text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_league_role(p_league_id, array['owner','admin']) then
    raise exception using errcode = '42501', message = 'Only league owners and admins can update a league.';
  end if;
  perform 1 from public.leagues where id = p_league_id for no key update;
  perform public.lock_league_access(p_league_id, array['owner','admin']);
  if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_visibility is null or p_visibility not in ('public','private') then
    raise exception using errcode = '22023', message = 'League name or visibility is invalid.';
  end if;
  update public.leagues set name = btrim(p_name), visibility = p_visibility where id = p_league_id;
end;
$$;

create or replace function public.create_player(p_league_id uuid, p_display_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  if not public.has_league_role(p_league_id, array['owner','admin','scorekeeper']) then
    raise exception using errcode = '42501', message = 'You do not have permission to add players to this league.';
  end if;
  perform 1 from public.leagues where id = p_league_id for key share;
  perform public.lock_league_access(p_league_id, array['owner','admin','scorekeeper']);
  if p_display_name is null or length(btrim(p_display_name)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Player name must contain 1 to 100 characters.';
  end if;
  insert into public.players(league_id, display_name) values (p_league_id, btrim(p_display_name)) returning id into v_id;
  return v_id;
end;
$$;
