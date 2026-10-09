-- Explicit one-off stakes are distinct from regular season games.
alter table public.games drop constraint if exists games_night_type_check;
alter table public.games add constraint games_night_type_check
  check (night_type in ('10','20','50','online','one-off','one-off-10','one-off-20'));

-- Preserve atomic writes, permissions, historical payouts, versions, and audit.
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
  -- Use an explicit one-off title, including its stake when given.
  if (p_game->>'title') ~* '\mone[[:space:]‐‑–—-]*offs?\M'
    and p_game->>'nightType' in ('10','20','one-off','one-off-10','one-off-20') then
    if (p_game->>'title') ~ '\$10\M' and (p_game->>'title') !~ '\$20\M' then
      p_game := jsonb_set(p_game, '{nightType}', '"one-off-10"'::jsonb);
    elsif (p_game->>'title') ~ '\$20\M' and (p_game->>'title') !~ '\$10\M' then
      p_game := jsonb_set(p_game, '{nightType}', '"one-off-20"'::jsonb);
    elsif p_game->>'nightType' in ('10','20') then
      p_game := jsonb_set(p_game, '{nightType}', to_jsonb('one-off-' || (p_game->>'nightType')));
    end if;
  end if;
  if jsonb_typeof(p_game->'nightType') is distinct from 'string' or (p_game->>'nightType') not in ('10','20','50','online','one-off','one-off-10','one-off-20')
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
  end loop;
  if p_game->>'status' = 'completed' and (
    jsonb_array_length(p_game->'results') < 2 or v_missing_cash or v_buy_total <= 0
  ) then
    raise exception using errcode = '22023', message = 'Completed games need at least two players, known cash-outs, and a positive total buy-in.';
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
