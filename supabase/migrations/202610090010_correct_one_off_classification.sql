-- The game title explicitly identifies one-offs. Existing regular night_type
-- supplies the nominal stake; participant buy-ins may contain rebuys and must
-- never be used to guess either classification or nominal stake.
-- Retain IDs, source references, dates, seasons, results, and monetary amounts.
do $$
declare
  v_game record;
  v_before jsonb;
  v_type text;
begin
  for v_game in
    select * from public.games
    where night_type in ('10', '20', 'one-off') and (
      title ~* '\mone[[:space:]‐‑–—-]*offs?\M'
      or source_ref ~* '-one-off-'
      or notes ~* '^Excluded from workbook totals'
    )
    order by league_id, id
    for update
  loop
    v_type := case
      -- An explicit stake in the title takes precedence over the old category.
      when v_game.title ~ '\$10\M' and v_game.title !~ '\$20\M' then 'one-off-10'
      when v_game.title ~ '\$20\M' and v_game.title !~ '\$10\M' then 'one-off-20'
      when v_game.night_type = '10' then 'one-off-10'
      when v_game.night_type = '20' then 'one-off-20'
      else 'one-off'
    end;
    if v_type = v_game.night_type then continue; end if;
    v_before := public.game_snapshot(v_game.league_id, v_game.id);
    update public.games set night_type = v_type, version = version + 1, updated_at = now()
      where league_id = v_game.league_id and id = v_game.id;
    insert into public.game_audit_log(league_id, game_id, action, actor_id, actor_snapshot, before_data, after_data)
    values (v_game.league_id, v_game.id, 'update', null,
      jsonb_build_object('migration', '202610090010', 'reason', 'Explicit one-off title or import metadata'),
      v_before, public.game_snapshot(v_game.league_id, v_game.id));
  end loop;
end;
$$;
