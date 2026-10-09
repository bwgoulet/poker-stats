-- Historical UNC games only. Preserve IDs, results, and source history.
begin;
lock table public.games, public.game_results, public.game_audit_log in share row exclusive mode;
create temporary table _stakes (id text primary key, old_type text, new_type text) on commit drop;
insert into _stakes values
  ('fall-2025-one-off-2025-10-03', 'one-off', '10'),
  ('fall-2025-one-off-2025-10-10', 'one-off', '20'),
  ('fall-2025-one-off-2025-10-27', 'one-off', '10'),
  ('fall-2025-one-off-2025-12-07', 'one-off', '20'),
  ('fall-2025-one-off-2025-12-12', 'one-off', '20'),
  ('spring-2026-one-off-2026-01-16', 'one-off', '10'),
  ('spring-2026-one-off-2026-01-31', 'one-off', '10'),
  ('spring-2026-one-off-2026-04-28', 'one-off', '10'),
  ('fall-2026-one-off-2026-08-20', 'one-off', '10'),
  ('fall-2026-one-off-2026-08-30', 'one-off', '10'),
  ('fall-2026-one-off-2026-09-03', 'one-off', '20'),
  ('fall-2026-one-off-2026-09-20', 'one-off', '10'),
  ('fall-2026-one-off-2026-09-26', 'one-off', '20'),
  ('fall-2026-one-off-2026-09-27', 'one-off', '10'),
  ('fall-2026-online-2026-09-27', 'online', '20'),
  ('fall-2026-one-off-2026-09-30', 'one-off', '20'),
  ('fall-2026-one-off-2026-10-05', 'one-off', '10');
do $check$
begin
  if exists (select 1 from _stakes s left join public.games g
    on g.id = s.id and g.league_id = '00000000-0000-4000-8000-000000000001'
    where g.id is null or g.night_type not in (s.old_type, s.new_type, 'one-off-' || s.new_type)) then
    raise exception 'Historical stake classification conflicts with existing games. No changes applied.';
  end if;
  if exists (select 1 from _stakes s join public.games g
    on g.id = s.id and g.league_id = '00000000-0000-4000-8000-000000000001'
    where g.night_type = s.old_type and (g.version <> case
      when s.id in ('fall-2025-one-off-2025-10-03', 'fall-2025-one-off-2025-10-10',
        'fall-2025-one-off-2025-10-27', 'fall-2026-one-off-2026-09-03') then 2 else 1 end
      or s.new_type <> case when exists (select 1 from public.game_results r
        where r.league_id = g.league_id and r.game_id = g.id and r.buy_in_cents = 1000)
        then '10' else '20' end)) then
    raise exception 'Review edited games or apply correction 005 before stake classification. No changes applied.';
  end if;
end;
$check$;
create temporary table _stake_changes on commit drop as
select g.id, s.old_type, s.new_type, to_jsonb(g) as before_data
from public.games g join _stakes s on s.id = g.id
where g.league_id = '00000000-0000-4000-8000-000000000001' and g.night_type = s.old_type;
update public.games g set night_type = c.new_type,
  title = '$' || c.new_type || ' ' || case c.old_type when 'online' then 'online' else 'one-off' end || ' · ' || g.date,
  notes = coalesce(g.notes, '') || E'\nHistorical stake classification 008: originally ' || c.old_type ||
    '; classified as $' || c.new_type || case c.new_type when '10' then ' because a recorded player bought in for exactly $10.' else ' because no recorded player bought in for $10; inferred $20 game.' end,
  version = g.version + 1, updated_at = now()
from _stake_changes c where g.id = c.id and g.league_id = '00000000-0000-4000-8000-000000000001';
insert into public.game_audit_log (league_id, game_id, action, actor_snapshot, before_data, after_data)
select g.league_id, g.id, 'update', '{"migration":"202610090008","reason":"Owner-requested historical stake classification"}'::jsonb,
 c.before_data, to_jsonb(g)
from _stake_changes c join public.games g on g.id = c.id
where g.league_id = '00000000-0000-4000-8000-000000000001';
commit;
