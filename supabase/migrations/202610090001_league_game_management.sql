-- League-scoped poker records. Browser clients read through RLS and mutate only
-- through the RPCs below; all validation and authorization also run in Postgres.
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 80),
  name text not null check (length(btrim(name)) between 1 and 100),
  currency text not null default 'USD' check (currency = 'USD'),
  timezone text not null default 'America/New_York',
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);

create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'scorekeeper', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index league_members_user_idx on public.league_members(user_id, league_id);

create table public.players (
  league_id uuid not null references public.leagues(id) on delete cascade,
  id text not null default gen_random_uuid()::text check (length(id) between 1 and 180 and id ~ '^[A-Za-z0-9_-]+$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (league_id, id)
);
create unique index players_league_name_idx on public.players(league_id, lower(btrim(display_name)));

create table public.games (
  league_id uuid not null references public.leagues(id) on delete cascade,
  id text not null default gen_random_uuid()::text check (length(id) between 1 and 180 and id ~ '^[A-Za-z0-9_-]+$'),
  title text not null check (length(btrim(title)) between 1 and 120),
  date date not null check (date between date '1900-01-01' and date '2100-12-31'),
  season_id text not null check (season_id ~ '^[a-z][a-z0-9-]*-\d{4}$' and length(season_id) <= 80),
  night_type text not null check (night_type in ('10', '20', '50', 'online', 'one-off')),
  format text not null check (format in ('cash', 'tournament')),
  status text not null check (status in ('draft', 'completed')),
  notes text not null default '' check (length(notes) <= 2000),
  version integer not null default 1 check (version > 0),
  -- Kept for imported records so reconciliation never silently invents payouts.
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, id)
);
create index games_league_date_idx on public.games(league_id, date desc);

create table public.game_results (
  league_id uuid not null,
  game_id text not null,
  player_id text not null,
  buy_in_cents integer not null check (buy_in_cents between 0 and 100000000),
  cash_out_cents integer check (cash_out_cents between 0 and 100000000),
  placement integer check (placement > 0),
  legacy_profit_cents integer,
  primary key (league_id, game_id, player_id),
  foreign key (league_id, game_id) references public.games(league_id, id) on delete cascade,
  foreign key (league_id, player_id) references public.players(league_id, id) on delete restrict
);
create index game_results_player_idx on public.game_results(league_id, player_id);

create table public.game_audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately no FK: deletion of a league, game, or auth user retains history.
  league_id uuid not null,
  game_id text not null,
  action text not null check (action in ('create', 'update', 'delete')),
  actor_id uuid,
  actor_snapshot jsonb not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index game_audit_league_idx on public.game_audit_log(league_id, created_at desc);

insert into public.leagues(id, slug, name, visibility)
values ('00000000-0000-4000-8000-000000000001', 'unc-poker', 'UNC Poker', 'public');

-- SECURITY DEFINER helpers prevent recursive membership policies. They expose only
-- whether the caller is a member / whether a league is publicly readable.
create function public.has_league_role(p_league_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.league_members m
    where m.league_id = p_league_id and m.user_id = auth.uid() and m.role = any(p_roles)
  );
$$;
create function public.is_public_league(p_league_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.leagues l where l.id = p_league_id and l.visibility = 'public');
$$;

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_results enable row level security;
alter table public.game_audit_log enable row level security;

create policy leagues_read on public.leagues for select to anon, authenticated using (
  visibility = 'public' or public.has_league_role(id, array['owner','admin','scorekeeper','viewer'])
);
create policy members_read on public.league_members for select to authenticated using (
  public.has_league_role(league_id, array['owner','admin','scorekeeper','viewer'])
);
create policy players_read on public.players for select to anon, authenticated using (
  public.is_public_league(league_id) or public.has_league_role(league_id, array['owner','admin','scorekeeper','viewer'])
);
create policy games_read on public.games for select to anon, authenticated using (
  (status = 'completed' and public.is_public_league(league_id))
  or public.has_league_role(league_id, array['owner','admin','scorekeeper','viewer'])
);
create policy results_read on public.game_results for select to anon, authenticated using (
  exists (
    select 1 from public.games g
    where g.league_id = game_results.league_id and g.id = game_results.game_id
      and ((g.status = 'completed' and public.is_public_league(g.league_id))
        or public.has_league_role(g.league_id, array['owner','admin','scorekeeper','viewer']))
  )
);
create policy audit_read on public.game_audit_log for select to authenticated using (
  public.has_league_role(league_id, array['owner','admin'])
);

-- A game snapshot includes result rows and provenance; called only inside RPCs.
create function public.game_snapshot(p_league_id uuid, p_game_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(g) || jsonb_build_object('results', coalesce((
    select jsonb_agg(to_jsonb(r) order by r.player_id) from public.game_results r
    where r.league_id = g.league_id and r.game_id = g.id
  ), '[]'::jsonb))
  from public.games g where g.league_id = p_league_id and g.id = p_game_id;
$$;

create function public.save_game(p_league_id uuid, p_game jsonb)
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
  -- Hold the membership lock until commit so a role revocation cannot race a write.
  perform 1 from public.league_members where league_id = p_league_id and user_id = auth.uid()
    and role in ('owner','admin','scorekeeper') for share;
  if not found then
    raise exception using errcode = '42501', message = 'Your league role has changed. Reload and try again.';
  end if;
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

create function public.delete_game(p_league_id uuid, p_game_id text, p_expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_version integer; v_before jsonb;
begin
  if not public.has_league_role(p_league_id, array['owner','admin','scorekeeper']) then
    raise exception using errcode = '42501', message = 'You do not have permission to delete games in this league.';
  end if;
  perform 1 from public.leagues where id = p_league_id for key share;
  perform 1 from public.league_members where league_id = p_league_id and user_id = auth.uid()
    and role in ('owner','admin','scorekeeper') for share;
  if not found then raise exception using errcode = '42501', message = 'Your league role has changed.'; end if;
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

create function public.create_league(p_name text, p_slug text, p_visibility text default 'private')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in to create a league.'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 100
    or p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_slug) not between 2 and 80
    or p_visibility is null or p_visibility not in ('public','private') then
    raise exception using errcode = '22023', message = 'League name, slug or visibility is invalid.';
  end if;
  insert into public.leagues(name, slug, visibility) values (btrim(p_name), p_slug, p_visibility) returning id into v_id;
  insert into public.league_members(league_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;

create function public.update_league(p_league_id uuid, p_name text, p_visibility text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_league_role(p_league_id, array['owner','admin']) then
    raise exception using errcode = '42501', message = 'Only league owners and admins can update a league.';
  end if;
  perform 1 from public.leagues where id = p_league_id for no key update;
  perform 1 from public.league_members where league_id = p_league_id and user_id = auth.uid()
    and role in ('owner','admin') for share;
  if not found then raise exception using errcode = '42501', message = 'Your league role has changed.'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_visibility is null or p_visibility not in ('public','private') then
    raise exception using errcode = '22023', message = 'League name or visibility is invalid.';
  end if;
  update public.leagues set name = btrim(p_name), visibility = p_visibility where id = p_league_id;
end;
$$;

create function public.delete_league(p_league_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_league_role(p_league_id, array['owner']) then
    raise exception using errcode = '42501', message = 'Only the league owner can delete a league.';
  end if;
  -- The exclusive league lock serializes deletion with game/player inserts.
  perform 1 from public.leagues where id = p_league_id for update;
  perform 1 from public.league_members where league_id = p_league_id and user_id = auth.uid() and role = 'owner' for share;
  if not found then raise exception using errcode = '42501', message = 'Your league role has changed.'; end if;
  if exists(select 1 from public.games where league_id = p_league_id) then
    raise exception using errcode = '22023', message = 'Delete all games before deleting this league.';
  end if;
  delete from public.leagues where id = p_league_id;
end;
$$;

create function public.create_player(p_league_id uuid, p_display_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  if not public.has_league_role(p_league_id, array['owner','admin','scorekeeper']) then
    raise exception using errcode = '42501', message = 'You do not have permission to add players to this league.';
  end if;
  perform 1 from public.leagues where id = p_league_id for key share;
  perform 1 from public.league_members where league_id = p_league_id and user_id = auth.uid()
    and role in ('owner','admin','scorekeeper') for share;
  if not found then raise exception using errcode = '42501', message = 'Your league role has changed.'; end if;
  if p_display_name is null or length(btrim(p_display_name)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Player name must contain 1 to 100 characters.';
  end if;
  insert into public.players(league_id, display_name) values (p_league_id, btrim(p_display_name)) returning id into v_id;
  return v_id;
end;
$$;

revoke all on public.leagues, public.league_members, public.players, public.games, public.game_results,
  public.game_audit_log from public, anon, authenticated;
grant select on public.leagues, public.players, public.games, public.game_results to anon, authenticated;
grant select on public.league_members, public.game_audit_log to authenticated;
grant all on public.leagues, public.league_members, public.players, public.games, public.game_results,
  public.game_audit_log to service_role;

revoke all on function public.has_league_role(uuid,text[]), public.is_public_league(uuid),
  public.game_snapshot(uuid,text), public.save_game(uuid,jsonb), public.delete_game(uuid,text,integer),
  public.create_league(text,text,text), public.update_league(uuid,text,text), public.delete_league(uuid),
  public.create_player(uuid,text) from public, anon, authenticated;
grant execute on function public.has_league_role(uuid,text[]), public.is_public_league(uuid) to anon, authenticated;
grant execute on function public.save_game(uuid,jsonb), public.delete_game(uuid,text,integer),
  public.create_league(text,text,text), public.update_league(uuid,text,text), public.delete_league(uuid),
  public.create_player(uuid,text) to authenticated;
grant execute on function public.has_league_role(uuid,text[]), public.is_public_league(uuid),
  public.game_snapshot(uuid,text), public.save_game(uuid,jsonb), public.delete_game(uuid,text,integer),
  public.create_league(text,text,text), public.update_league(uuid,text,text), public.delete_league(uuid),
  public.create_player(uuid,text) to service_role;
