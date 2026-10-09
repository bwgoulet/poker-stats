import Link from 'next/link';
import { getPokerData } from '@/lib/data/poker-repository';
import { getDataSeasonIds, parseFilters, filterNights, filterResults, scopeLabel } from '@/lib/filters/filter-data';
import { playerStats, MIN_SAMPLE_SIZE } from '@/lib/stats/statistics';
import { dollars, pct } from '@/lib/formatting/format';

type BoardRow = { id: string; label: string; value: string; href: string };

export default async function Stats({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const data = await getPokerData();
  const seasonIds = getDataSeasonIds(data.nights);
  const filters = parseFilters(sp, seasonIds);
  const nights = filterNights(data.nights, filters);
  const results = filterResults(data.results, data.nights, filters);
  const stats = playerStats(data.players, nights, results).filter(stat => stat.nightsPlayed >= filters.minNights);
  const roi = stats.filter(stat => stat.nightsPlayed >= MIN_SAMPLE_SIZE).sort((a, b) => b.roi - a.roi).slice(0, 10);
  const eligiblePlayers = new Set(stats.map(stat => stat.player.id));
  const single = results.filter(result => eligiblePlayers.has(result.playerId)).sort((a, b) => b.profit - a.profit).slice(0, 10);
  const players = new Map(data.players.map(player => [player.id, player.displayName]));
  const query = new URLSearchParams(sp as Record<string, string>).toString();
  const playerRow = (stat: typeof stats[number]): BoardRow => ({ id: stat.player.id, label: stat.player.displayName, value: dollars(stat.totalProfit), href: `/players/${stat.player.id}?${query}` });

  return <><header><p className="text-carolina-dark font-semibold">{scopeLabel(filters, seasonIds)}</p><h1 className="text-4xl font-black">Stats</h1></header><section className="grid lg:grid-cols-3 gap-5">
    <Board title="Most profitable" rows={stats.slice(0, 10).map(playerRow)} />
    <Board title={`Highest ROI (${MIN_SAMPLE_SIZE}+ nights)`} rows={roi.map(stat => ({ ...playerRow(stat), value: pct(stat.roi) }))} />
    <Board title="Largest single-night wins" rows={single.map(result => ({ id: result.nightId, label: players.get(result.playerId) ?? result.sourceName, value: dollars(result.profit), href: `/games/${result.nightId}?${query}` }))} />
  </section><div className="card p-5"><h2 className="font-bold text-xl mb-2">Data quality</h2><p className="text-gray-600">{data.issues.length} validation or reconciliation notes for this league.</p></div></>;
}

function Board({ title, rows }: { title: string; rows: BoardRow[] }) {
  return <div className="card p-5"><h2 className="font-bold text-xl mb-3">{title}</h2>{rows.map((row, index) => <div className="flex justify-between border-t py-2" key={`${row.id}-${index}`}><span>#{index + 1} <Link className="font-semibold text-navy hover:underline" href={row.href}>{row.label}</Link></span><b>{row.value}</b></div>)}</div>;
}
