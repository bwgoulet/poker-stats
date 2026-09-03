import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPokerData } from '@/lib/data/poker-repository';
import { parseFilters, filterNights, filterResults, scopeLabel } from '@/lib/filters/filter-data';
import { playerStats, sortResultsByDate } from '@/lib/stats/statistics';
import { classifyPlayers } from '@/lib/stats/player-classification';
import { buyInUnits, dollars, pct, dateFmt, streakLabel } from '@/lib/formatting/format';
import { ProfitTimeline } from '@/components/charts/ProfitTimeline';

export default async function Player({ params, searchParams }: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { playerId } = await params;
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const data = getPokerData();
  const player = data.players.find((candidate) => candidate.id === playerId);
  if (!player) notFound();

  const nights = filterNights(data.nights, filters);
  const results = filterResults(data.results, data.nights, filters);
  const allStats = playerStats(data.players, nights, results);
  const stats = allStats.find((stat) => stat.player.id === player.id)!;
  const classification = classifyPlayers(allStats, nights).get(player.id)!;
  let cumulativeProfit = 0;
  const timeline = sortResultsByDate(stats.results, data.nights).map((result) => {
    cumulativeProfit += result.profit;
    return { date: data.nights.find((night) => night.id === result.nightId)!.date, profit: cumulativeProfit };
  });
  const gameHistory = sortResultsByDate(stats.results, data.nights, 'desc');
  const headlineStats = [
    { label: 'Profit', value: dollars(stats.totalProfit) },
    { label: 'ROI', value: pct(stats.roi), help: 'Return on investment: total profit divided by total buy-in.' },
    { label: 'Nights', value: String(stats.nightsPlayed) },
    { label: 'Win rate', value: pct(stats.winRate) },
  ];
  const detailStats = [
    { label: 'Total buy-in', value: dollars(stats.totalBuyIn) },
    { label: 'Average profit', value: dollars(stats.avgProfit) },
    { label: 'Median profit', value: dollars(stats.medianProfit) },
    { label: 'Average buy-in', value: dollars(stats.avgBuyIn) },
    { label: 'Buy-in intensity', value: buyInUnits(classification.averageBuyInUnits), help: 'Average amount bought in per qualifying night, expressed in multiples of that night’s nominal buy-in.' },
    { label: 'Outcome swing', value: buyInUnits(classification.outcomeSwing), help: 'Typical variation in normalized nightly profit, expressed in nominal buy-ins using a robust standard deviation estimate.' },
    { label: 'Biggest win', value: dollars(stats.biggestWin) },
    { label: 'Biggest loss', value: dollars(stats.biggestLoss) },
    { label: 'Current streak', value: streakLabel(stats.currentStreak) },
    { label: 'Best streak', value: streakLabel(stats.bestStreak) },
    { label: 'First appearance', value: stats.firstAppearance ? dateFmt(stats.firstAppearance) : '—' },
    { label: 'Last appearance', value: stats.lastAppearance ? dateFmt(stats.lastAppearance) : '—' },
  ];

  return <>
    <header>
      <p className="text-carolina-dark font-semibold">{scopeLabel(filters)}</p>
      <h1 className="text-4xl font-black">{player.displayName}</h1>
      <p className="text-gray-500">Rank #{stats.rank}</p>
    </header>
    <section className="grid md:grid-cols-4 gap-4" aria-label="Player highlights">
      {headlineStats.map(({ label, value, help }) => <div className="card p-5" key={label}>
        <p className="text-gray-500" title={help}>{label}{help && <span aria-label={help}> ⓘ</span>}</p>
        <b className="text-2xl">{value}</b>
      </div>)}
    </section>
    <section className="card p-5" aria-labelledby="performance-details">
      <h2 className="font-bold text-xl mb-3" id="performance-details">Performance details</h2>
      <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {detailStats.map(({ label, value, help }) => <div className="flex justify-between gap-4 border-t py-3" key={label}>
          <dt className="text-gray-500" title={help}>{label}{help && <span aria-label={help}> ⓘ</span>}</dt>
          <dd className="font-semibold text-right">{value}</dd>
        </div>)}
      </dl>
    </section>
    <div className="card p-5">
      <h2 className="font-bold text-xl">Cumulative profit</h2>
      <ProfitTimeline data={timeline} />
    </div>
    <div className="card p-5">
      <h2 className="font-bold text-xl mb-3">Game history</h2>
      {gameHistory.length === 0 && <p className="text-gray-500">No games match the selected filters.</p>}
      {gameHistory.map((result) => {
        const night = data.nights.find((candidate) => candidate.id === result.nightId)!;
        return <Link className="flex justify-between border-t py-3" href={`/games/${night.id}?${new URLSearchParams(sp as Record<string, string>)}`} key={night.id}>
          <span>{dateFmt(night.date)} · {night.title}</span>
          <b className={result.profit >= 0 ? 'text-green-700' : 'text-rose-700'}>{dollars(result.profit)}</b>
        </Link>;
      })}
    </div>
  </>;
}
