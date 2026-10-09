-- Drafts share their league's read access. Write permissions are unchanged.
alter policy games_read on public.games using (
  public.is_public_league(league_id)
  or public.has_league_role(league_id, array['owner','admin','scorekeeper','viewer'])
);

alter policy results_read on public.game_results using (
  exists (
    select 1 from public.games g
    where g.league_id = game_results.league_id and g.id = game_results.game_id
      and (public.is_public_league(g.league_id)
        or public.has_league_role(g.league_id, array['owner','admin','scorekeeper','viewer']))
  )
);
