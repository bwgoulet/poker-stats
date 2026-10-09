import type { WorkbookImport } from './import-workbooks';
import { UNC_LEAGUE_ID } from './types';

/** Compare a frozen export with the database without changing any records. */
export function buildWorkbookVerificationSql(imported: Pick<WorkbookImport, 'players' | 'games'>): string {
  const expected = [
    ...imported.players.map(player => ({
      record_type: 'player', record_key: [player.id],
      record_value: {
        display_name: player.displayName,
        aliases: [...player.aliases].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))),
      },
    })),
    ...imported.games.map(game => ({
      record_type: 'game', record_key: [game.id],
      record_value: {
        title: game.title, date: game.date, season_id: game.seasonId, night_type: game.nightType,
        format: game.format, status: game.status, notes: game.notes, source_ref: game.sourceRef,
      },
    })),
    ...imported.games.flatMap(game => game.results.map(result => ({
      record_type: 'result', record_key: [game.id, result.playerId],
      record_value: {
        buy_in_cents: result.buyInCents, cash_out_cents: result.cashOutCents,
        placement: result.placement, legacy_profit_cents: result.legacyProfitCents,
      },
    }))),
  ];
  const encoded = JSON.stringify(expected, (_key, value) => {
    if (typeof value === 'string' && value.includes('\0')) throw new Error('PostgreSQL text cannot contain a null byte');
    return value;
  });
  const source = `'${encoded.replaceAll("'", "''")}'::jsonb`;
  const league = `'${UNC_LEAGUE_ID}'::uuid`;
  return `-- Verify the frozen workbook export AFTER importing, BEFORE editing historical records.
-- Execute the entire file as the project administrator. Every passed value must be true.
-- Extra new players/games are allowed; extra results on historical games are reported.
-- Missing, changed, and unexpected records are reported in mismatches. No data is modified.
begin isolation level repeatable read read only;
set local standard_conforming_strings = on;

with expected as (
  select * from jsonb_to_recordset(${source})
    as e(record_type text, record_key jsonb, record_value jsonb)
), actual as (
  select 'player'::text as record_type, jsonb_build_array(p.id) as record_key,
    jsonb_build_object('display_name', p.display_name,
      'aliases', coalesce((select array_agg(alias order by alias collate "C") from unnest(p.aliases) alias), array[]::text[])) as record_value
  from public.players p
  join expected e on e.record_type = 'player' and e.record_key = jsonb_build_array(p.id)
  where p.league_id = ${league}
  union all
  select 'game', jsonb_build_array(g.id),
    jsonb_build_object('title', g.title, 'date', g.date, 'season_id', g.season_id,
      'night_type', g.night_type, 'format', g.format, 'status', g.status,
      'notes', g.notes, 'source_ref', g.source_ref)
  from public.games g
  join expected e on e.record_type = 'game' and e.record_key = jsonb_build_array(g.id)
  where g.league_id = ${league}
  union all
  select 'result', jsonb_build_array(r.game_id, r.player_id),
    jsonb_build_object('buy_in_cents', r.buy_in_cents, 'cash_out_cents', r.cash_out_cents,
      'placement', r.placement, 'legacy_profit_cents', r.legacy_profit_cents)
  from public.game_results r
  join expected e on e.record_type = 'game' and e.record_key = jsonb_build_array(r.game_id)
  where r.league_id = ${league}
), comparisons as (
  select coalesce(e.record_type, a.record_type) as record_type,
    coalesce(e.record_key, a.record_key) as record_key,
    case when e.record_key is null then 'unexpected'
      when a.record_key is null then 'missing'
      when e.record_value is distinct from a.record_value then 'changed'
      else 'matched' end as outcome
  from expected e full join actual a using (record_type, record_key)
)
select t.record_type,
  count(*) filter (where c.outcome <> 'unexpected')::integer as expected_count,
  count(*) filter (where c.outcome = 'matched')::integer as matched_count,
  count(*) filter (where c.outcome = 'missing')::integer as missing_count,
  count(*) filter (where c.outcome = 'changed')::integer as changed_count,
  count(*) filter (where c.outcome = 'unexpected')::integer as unexpected_count,
  count(*) filter (where c.outcome <> 'matched') = 0 as passed,
  coalesce(jsonb_agg(jsonb_build_object('key', c.record_key, 'reason', c.outcome)
    order by c.record_key) filter (where c.outcome <> 'matched'), '[]'::jsonb) as mismatches
from (values ('player'), ('game'), ('result')) t(record_type)
left join comparisons c using (record_type)
group by t.record_type
order by t.record_type;

commit;
`;
}
