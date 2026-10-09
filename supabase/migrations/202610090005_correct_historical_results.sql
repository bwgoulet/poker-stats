-- Apply after migration 004. Owner-confirmed corrections only; live-game
-- counting differences remain recorded. Run the entire transaction together.
-- $36.10 cash-out - $50.00 buy-in = -$13.90, not a positive profit.
begin;
lock table public.games, public.game_results, public.game_audit_log in share row exclusive mode;

create temporary table _net_corrections (
  game_id text primary key, player_id text not null,
  buy_in_cents integer not null, cash_out_cents integer not null,
  old_net_cents integer not null
) on commit drop;
insert into _net_corrections values
  ('fall-2025-20-2025-10-16', 'chris', 3000, 1540, -1560),
  ('fall-2025-one-off-2025-10-10', 'tim', 4000, 1990, -2110),
  ('fall-2025-one-off-2025-10-27', 'tim', 1000, 0, 0),
  ('spring-2026-20-2026-02-04', 'drew', 4300, 2560, -1940),
  ('summer-2026-20-2026-08-16', 'tim', 4000, 1090, -3110),
  ('fall-2026-one-off-2026-09-03', 'tim', 6000, 11160, 5660);

do $check$
declare league constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  if exists (
    select 1 from _net_corrections c
    left join public.game_results r on r.league_id = league and r.game_id = c.game_id and r.player_id = c.player_id
    where r.player_id is null or r.buy_in_cents <> c.buy_in_cents
      or r.cash_out_cents is distinct from c.cash_out_cents
      or (r.legacy_profit_cents is not null and r.legacy_profit_cents <> c.old_net_cents)
  ) then
    raise exception 'Historical Net correction conflicts with an existing result. No changes applied.';
  end if;
  if exists (
    select 1 from public.game_results r
    where r.league_id = league and r.game_id = 'fall-2025-one-off-2025-10-03' and r.player_id = 'drew'
      and (r.buy_in_cents <> 5000 or r.cash_out_cents is distinct from 3610 or r.legacy_profit_cents is not null)
  ) then
    raise exception 'Drew already has a different October 3 result. No changes applied.';
  end if;
  if not exists (select 1 from public.players where league_id = league and id = 'drew') then
    raise exception 'Apply the historical import before correcting Drew. No changes applied.';
  end if;
end;
$check$;

-- Capture only games that need a change. An exact rerun is a complete no-op,
-- including versions, notes, placements and audit entries.
create temporary table _corrected_games on commit drop as
select g.id, jsonb_build_object('game', to_jsonb(g), 'results', (
  select jsonb_agg(to_jsonb(r) order by r.player_id) from public.game_results r
  where r.league_id = g.league_id and r.game_id = g.id
)) as before_data
from public.games g
where g.league_id = '00000000-0000-4000-8000-000000000001' and (
  exists (select 1 from _net_corrections c join public.game_results r
    on r.league_id = g.league_id and r.game_id = c.game_id and r.player_id = c.player_id
    where c.game_id = g.id and r.legacy_profit_cents is not null)
  or (g.id = 'fall-2025-one-off-2025-10-03' and not exists (
    select 1 from public.game_results r where r.league_id = g.league_id and r.game_id = g.id and r.player_id = 'drew'
  ))
);

do $check_games$
begin
  if not exists (select 1 from public.games
    where league_id = '00000000-0000-4000-8000-000000000001' and id = 'fall-2025-one-off-2025-10-03')
    or exists (select 1 from _corrected_games c join public.games g on g.id = c.id
      and g.league_id = '00000000-0000-4000-8000-000000000001'
      where g.format <> 'cash' or g.status <> 'completed' or g.version <> 1
        or g.source_ref is distinct from 'workbook:v1:' || g.season_id || '.xlsx#' || g.id)
  then
    raise exception 'Historical correction requires the original imported games. Review portal edits first. No changes applied.';
  end if;
end;
$check_games$;

update public.game_results r set legacy_profit_cents = null
from _net_corrections c
where r.league_id = '00000000-0000-4000-8000-000000000001'
  and r.game_id = c.game_id and r.player_id = c.player_id and r.legacy_profit_cents is not null;

insert into public.game_results (league_id, game_id, player_id, buy_in_cents, cash_out_cents, placement, legacy_profit_cents)
select '00000000-0000-4000-8000-000000000001', 'fall-2025-one-off-2025-10-03', 'drew', 5000, 3610, null, null
where not exists (select 1 from public.game_results
  where league_id = '00000000-0000-4000-8000-000000000001' and game_id = 'fall-2025-one-off-2025-10-03' and player_id = 'drew');

-- Cash placements in this import were inferred from profit. Refresh those
-- ranks after corrections, retaining the previous order of equal profits.
with ranked as (
  select r.league_id, r.game_id, r.player_id,
    row_number() over (partition by r.game_id order by
      coalesce(r.legacy_profit_cents, r.cash_out_cents - r.buy_in_cents) desc,
      r.placement nulls last, r.player_id)::integer as placement
  from public.game_results r join _corrected_games c on c.id = r.game_id
  where r.league_id = '00000000-0000-4000-8000-000000000001'
)
update public.game_results r set placement = n.placement
from ranked n where (r.league_id, r.game_id, r.player_id) = (n.league_id, n.game_id, n.player_id);

update public.games g set version = version + 1, updated_at = now(), notes = notes || E'\n'
  || case when g.id = 'fall-2025-one-off-2025-10-03'
    then 'Historical correction 005: Drew buy-in $50.00, cash-out $36.10, Net -$13.90. Original import notes retained as source history.'
    else 'Historical correction 005: confirmed cash-out minus buy-in replaces the spreadsheet Net error. Original import notes are source history.' end
from _corrected_games c where g.league_id = '00000000-0000-4000-8000-000000000001' and g.id = c.id;

insert into public.game_audit_log (league_id, game_id, action, actor_snapshot, before_data, after_data)
select g.league_id, g.id, 'update',
  '{"migration":"202610090005","reason":"Owner-confirmed missing payout and spreadsheet Net corrections"}'::jsonb,
  c.before_data, jsonb_build_object('game', to_jsonb(g), 'results', (
    select jsonb_agg(to_jsonb(r) order by r.player_id) from public.game_results r
    where r.league_id = g.league_id and r.game_id = g.id
  ))
from _corrected_games c join public.games g on g.id = c.id
where g.league_id = '00000000-0000-4000-8000-000000000001';
commit;
