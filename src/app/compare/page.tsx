import Link from 'next/link';
import { ComparisonProfitChart } from '@/components/charts/ComparisonProfitChart';
import { getPokerData } from '@/lib/data/poker-repository';
import { filterNights, filterResults, getDataSeasonIds, parseFilters, scopeLabel } from '@/lib/filters/filter-data';
import { dateFmt, dollars, pct } from '@/lib/formatting/format';
import { classifyPlayers, MIN_CLASSIFICATION_NIGHTS } from '@/lib/stats/player-classification';
import { playerStats } from '@/lib/stats/statistics';

type SearchParams = Record<string, string | string[] | undefined>;

function requestedPlayers(params: SearchParams) {
  const raw = params.player ?? params.players ?? params.playerId ?? [];
  return (Array.isArray(raw) ? raw : [raw]).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean);
}

export default async function Compare({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const data = await getPokerData();
  const seasonIds = getDataSeasonIds(data.nights);
  const filters = parseFilters(params, seasonIds);
  const requested = requestedPlayers(params);
  const uniqueIds = [...new Set(requested)];
  const duplicates = requested.length - uniqueIds.length;
  const missing = uniqueIds.filter((id) => !data.players.some((player) => player.id === id));
  const selectedIds = uniqueIds.filter((id) => !missing.includes(id));
  const nights = filterNights(data.nights, filters);
  const results = filterResults(data.results, data.nights, filters);
  const allStats = playerStats(data.players, nights, results);
  const classifications = classifyPlayers(allStats, nights);
  const selected = selectedIds.map((id) => allStats.find((stat) => stat.player.id === id)!).filter(Boolean);
  const nightMap = new Map(nights.map((night) => [night.id, night]));
  const selectedSet = new Set(selectedIds);
  const sharedNights = nights.filter((night) => {
    const participants = new Set(results.filter((result) => result.nightId === night.id).map((result) => result.playerId));
    return selectedIds.length >= 2 && selectedIds.every((id) => participants.has(id));
  }).sort((a, b) => b.date.localeCompare(a.date));

  const datedResults = results.filter((result) => selectedSet.has(result.playerId)).sort((a, b) => nightMap.get(a.nightId)!.date.localeCompare(nightMap.get(b.nightId)!.date));
  const dates = [...new Set(datedResults.map((result) => nightMap.get(result.nightId)!.date))];
  const totals = new Map(selectedIds.map((id) => [id, 0]));
  const chartData = dates.map((date) => {
    for (const result of datedResults.filter((item) => nightMap.get(item.nightId)!.date === date)) totals.set(result.playerId, totals.get(result.playerId)! + result.profit);
    return Object.fromEntries([['date', date], ...selectedIds.map((id) => [id, totals.get(id)!])]);
  });

  return <><header><p className="font-semibold text-carolina-dark">{scopeLabel(filters, seasonIds)}</p><h1 className="text-4xl font-black">Player comparison</h1><p className="mt-2 text-gray-600">Compare performance across the currently selected seasons and night types.</p></header>
    {(duplicates > 0 || missing.length > 0) && <div className="card border-amber-300 bg-amber-50 p-4 text-amber-900" role="status">{duplicates > 0 && <p>{duplicates} duplicate selection{duplicates === 1 ? ' was' : 's were'} ignored.</p>}{missing.length > 0 && <p>Unknown player ID{missing.length === 1 ? '' : 's'}: {missing.join(', ')}.</p>}</div>}
    {selected.length < 2 ? <div className="card p-8 text-center"><h2 className="text-xl font-bold">Choose at least two valid players</h2><p className="mt-2 text-gray-500">Use the checkboxes on the Players page to build a comparison.</p><Link href="/players" className="mt-4 inline-block rounded-lg bg-carolina-dark px-4 py-2 font-semibold text-white">Select players</Link></div> : <>
      {nights.length === 0 && <div className="card p-5 text-center text-gray-600">No nights match the filtered scope. Try changing the season or night type filters.</div>}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{selected.map((stat) => { const classification = classifications.get(stat.player.id)!; return <article className="card p-5" key={stat.player.id}><h2 className="text-2xl font-black">{stat.player.displayName}</h2><p className="mb-4 text-sm font-semibold text-navy">{classification.type}{classification.confidence === 'insufficient' ? ` (${classification.qualifyingNights}/${MIN_CLASSIFICATION_NIGHTS} nights)` : ''}</p><dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">{[
        ['Total profit', dollars(stat.totalProfit)], ['ROI', pct(stat.roi)], ['Nights played', String(stat.nightsPlayed)], ['Win rate', pct(stat.winRate)], ['Average buy-in', dollars(stat.avgBuyIn)], ['Volatility', pct(stat.volatility)], ['Biggest win', dollars(stat.biggestWin)], ['Biggest loss', dollars(stat.biggestLoss)],
      ].map(([label, value]) => <div key={label}><dt className="text-gray-500">{label}</dt><dd className="font-bold">{value}</dd></div>)}</dl>{stat.nightsPlayed < MIN_CLASSIFICATION_NIGHTS && <p className="mt-4 border-t pt-3 text-xs text-gray-500">Limited history: player type is unavailable until {MIN_CLASSIFICATION_NIGHTS} comparable nights are recorded.</p>}</article>; })}</section>
      <section className="card p-5"><h2 className="text-xl font-bold">Cumulative profit</h2><p className="text-sm text-gray-500">Running profit on every scoped date; players without a result carry their prior total forward.</p><ComparisonProfitChart data={chartData} players={selected.map((stat) => ({ id: stat.player.id, name: stat.player.displayName }))} /></section>
      <section className="card p-5"><h2 className="text-xl font-bold">Nights played together</h2><p className="mb-4 text-sm text-gray-500">All selected players participated in {sharedNights.length} night{sharedNights.length === 1 ? '' : 's'}.</p>{sharedNights.length === 0 ? <p className="rounded-lg bg-gray-50 p-4 text-gray-600">No nights in this scope included every selected player.</p> : <div className="divide-y">{sharedNights.map((night) => <Link href={`/games/${night.id}`} className="block py-3 hover:text-navy" key={night.id}><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{dateFmt(night.date)} · {night.title}</span><span>{selected.map((stat) => { const result = results.find((item) => item.nightId === night.id && item.playerId === stat.player.id)!; return `${stat.player.displayName}: ${dollars(result.profit)}`; }).join(' · ')}</span></div></Link>)}</div>}</section>
    </>}
  </>;
}
