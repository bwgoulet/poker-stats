import Link from 'next/link';

import { getPokerData } from '@/lib/data/poker-repository';
import {
  filterNights,
  filterResults,
  parseFilters,
  scopeLabel,
} from '@/lib/filters/filter-data';
import {
  leagueStats,
  nightStats,
  playerStats,
  recentForm,
} from '@/lib/stats/statistics';
import { ProfitDistribution } from '@/components/charts/ProfitDistribution';
import { dateFmt, dollars, pct } from '@/lib/formatting/format';

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const data = getPokerData();
  const nights = filterNights(data.nights, filters);
  const results = filterResults(data.results, data.nights, filters);
  const league = leagueStats(nights, results);
  const recentNights = nightStats(nights, results)
    .sort((a, b) => b.night.date.localeCompare(a.night.date))
    .slice(0, 6);
  const hot = recentForm(data.players, nights, results, 10).slice(0, 5);
  const playerBalance = playerStats(data.players, nights, results).filter(
    (stat) => stat.nightsPlayed > 0,
  );
  const params = new URLSearchParams(sp as Record<string, string>);

  return (
    <>
      <header>
        <p className="text-red-600 font-semibold">{scopeLabel(filters)}</p>
        <h1 className="text-4xl font-black">UNC Poker</h1>
        <p className="text-gray-600">
          A live read-only dashboard built from the league workbooks.
        </p>
      </header>
      {nights.length === 0 ? (
        <div className="card p-10 text-center">No poker nights match this filter.</div>
      ) : (
        <>
          <section className="grid md:grid-cols-4 gap-4">
            {[
              ['Nights', league.totalNights],
              ['Total buy-ins', dollars(league.totalMoney)],
              ['Avg pot', dollars(league.averagePot)],
              ['Active players', league.activePlayers],
            ].map(([key, value]) => (
              <div className="card p-5" key={key}>
                <p className="text-sm text-gray-500">{key}</p>
                <p className="text-2xl font-black">{value}</p>
              </div>
            ))}
          </section>

          <section className="grid lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h2 className="font-bold text-xl mb-3">Who’s hot</h2>
              {hot.map((stat) => (
                <Link
                  href={`/players/${stat.player.id}?${params}`}
                  className="flex justify-between border-t py-3"
                  key={stat.player.id}
                >
                  <span>
                    #{stat.rank} {stat.player.displayName}
                    <small className="block text-gray-500">
                      {stat.wins}-{stat.losses} · ROI {pct(stat.roi)}
                    </small>
                  </span>
                  <b className={stat.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                    {dollars(stat.totalProfit)}
                  </b>
                </Link>
              ))}
            </div>
            <div className="card p-5">
              <h2 className="font-bold text-xl mb-3">Recent nights</h2>
              {recentNights.map((night) => (
                <Link
                  href={`/games/${night.night.id}?${params}`}
                  className="flex justify-between border-t py-3"
                  key={night.night.id}
                >
                  <span>
                    {night.night.title}
                    <small className="block text-gray-500">
                      {dateFmt(night.night.date)} · {night.players} players
                    </small>
                  </span>
                  <b>{dollars(night.totalPot)}</b>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black mb-4">League balance</h2>
            <div className="card p-6 md:p-8">
              <p className="text-sm text-gray-700 mb-4">
                Profit distribution ({scopeLabel(filters).toLowerCase()})
              </p>
              <ProfitDistribution
                rows={playerBalance.map((stat) => ({
                  id: stat.player.id,
                  label: stat.player.displayName,
                  profit: stat.totalProfit,
                  href: `/players/${stat.player.id}?${params}`,
                }))}
              />
            </div>
          </section>
        </>
      )}
    </>
  );
}
