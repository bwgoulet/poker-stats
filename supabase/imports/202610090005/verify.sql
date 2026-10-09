-- Read-only verification of the seven owner-confirmed corrections.
-- Run after migration 005. Expected count and matched count must both be 7;
-- passed must be true. Unrelated/new games are intentionally excluded.
with expected(game_id, player_id, buy_in_cents, cash_out_cents) as (values
  ('fall-2025-one-off-2025-10-03', 'drew', 5000, 3610),
  ('fall-2025-20-2025-10-16', 'chris', 3000, 1540),
  ('fall-2025-one-off-2025-10-10', 'tim', 4000, 1990),
  ('fall-2025-one-off-2025-10-27', 'tim', 1000, 0),
  ('spring-2026-20-2026-02-04', 'drew', 4300, 2560),
  ('summer-2026-20-2026-08-16', 'tim', 4000, 1090),
  ('fall-2026-one-off-2026-09-03', 'tim', 6000, 11160)
), checked as (
  select e.*, r.player_id is not null and r.buy_in_cents = e.buy_in_cents
    and r.cash_out_cents is not distinct from e.cash_out_cents
    and r.legacy_profit_cents is null as matched
  from expected e left join public.game_results r
    on r.league_id = '00000000-0000-4000-8000-000000000001'
    and r.game_id = e.game_id and r.player_id = e.player_id
)
select count(*)::integer as expected_count,
  count(*) filter (where matched)::integer as matched_count,
  bool_and(matched) as passed,
  coalesce(jsonb_agg(jsonb_build_object('game_id', game_id, 'player_id', player_id))
    filter (where not matched), '[]'::jsonb) as mismatches
from checked;
