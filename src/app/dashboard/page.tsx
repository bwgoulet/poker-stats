import Link from 'next/link';

import { getPokerData } from '@/lib/data/poker-repository';
import {
  filterNights,
  filterResults,
  getCurrentSeasonId,
  getDataSeasonIds,
  type GlobalFilters,
  parseFilters,
  scopeLabel,
  seasonLabel,
} from '@/lib/filters/filter-data';
import {
  leagueStats,
  nightStats,
  playerStats,
  recentForm,
} from '@/lib/stats/statistics';
import { ProfitDistribution } from '@/components/charts/ProfitDistribution';
import { dateFmt, dollars, pct } from '@/lib/formatting/format';
import { canEdit } from '@/lib/backend/types';

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const data = await getPokerData();
  const seasonIds = getDataSeasonIds(data.nights);
  const filters = parseFilters(sp, seasonIds);
  const nights = filterNights(data.nights, filters);
  const results = filterResults(data.results, data.nights, filters);
  const league = leagueStats(nights, results);
  const recentNights = nightStats(nights, results)
    .sort((a, b) => b.night.date.localeCompare(a.night.date))
    .slice(0, 6);
  const eligiblePlayerIds = new Set(playerStats(data.players, nights, results)
    .filter((stat) => stat.nightsPlayed >= filters.minNights)
    .map((stat) => stat.player.id));
  const hot = recentForm(data.players, nights, results, 10)
    .filter((stat) => eligiblePlayerIds.has(stat.player.id))
    .slice(0, 5);
  const playerBalance = playerStats(data.players, nights, results).filter(
    (stat) => stat.nightsPlayed >= filters.minNights,
  );
  const params = new URLSearchParams(sp as Record<string, string>);
  const currentSeason = getCurrentSeasonId(data.nights);
  const snapshotFilters: GlobalFilters = {
    season: currentSeason ? [currentSeason] : [],
    nightType: ['20', '10'],
    minNights: 1,
  };
  const snapshotNights = filterNights(data.nights, snapshotFilters);
  const snapshotResults = filterResults(data.results, data.nights, snapshotFilters);
  const snapshotBalance = playerStats(
    data.players,
    snapshotNights,
    snapshotResults,
  ).filter((stat) => stat.nightsPlayed >= snapshotFilters.minNights);
  const snapshotParams = new URLSearchParams({
    season: snapshotFilters.season.join(','),
    nightType: snapshotFilters.nightType.join(','),
    minNights: String(snapshotFilters.minNights),
  });

  return (
    <>
      <header>
        <p className="text-carolina-dark font-semibold">{scopeLabel(filters, seasonIds)}</p>
        <h1 className="text-4xl font-black">{data.league.name}</h1>
        <p className="text-gray-600">
          {data.source === 'supabase'
            ? 'Live league statistics from completed games.'
            : 'Historical league statistics from the original workbooks.'}
        </p>
      </header>
      {nights.length === 0 ? (
        <div className="card p-10 text-center">
          <h2 className="text-xl font-bold">{!data.league.id ? 'Choose a league to get started' : data.nights.length === 0 ? 'No completed games yet' : 'No poker nights match this filter'}</h2>
          {!data.league.id && <Link className="mt-4 inline-block rounded-lg bg-carolina-dark px-5 py-2.5 font-bold text-white" href="/manage">Open league management</Link>}
          {data.nights.length === 0 && canEdit(data.league.role) && <><p className="mt-2 text-gray-600">Complete a game to start building your league statistics.</p><Link className="mt-4 inline-block rounded-lg bg-carolina-dark px-5 py-2.5 font-bold text-white" href="/manage?new=1">Record a game</Link></>}
        </div>
      ) : (
        <>
          <section className="grid md:grid-cols-4 gap-4">
            {[
              ['Nights', league.totalNights],
              ['Total buy-ins', dollars(league.totalMoney)],
              ['Avg pot', dollars(league.averagePot)],
              [`Players (${filters.minNights}+ nights)`, playerBalance.length],
            ].map(([key, value]) => (
              <div className="card p-5" key={key}>
                <p className="text-sm text-gray-500">{key}</p>
                <p className="text-2xl font-black">{value}</p>
              </div>
            ))}
          </section>

          <section className="grid lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h2 className="font-bold text-xl mb-3">
                Who’s hot <span className="font-normal">(Last 10 Games)</span>
              </h2>
              {hot.map((stat) => (
                <Link
                  href={`/players/${stat.player.id}?${params}`}
                  className="flex justify-between border-t py-3"
                  key={stat.player.id}
                >
                  <span>
                    #{stat.rank} {stat.player.displayName}
                    <small className="block text-gray-500">
                      {stat.wins}-{stat.losses} · ROI {pct(stat.roi)} · Volatility{' '}
                      {pct(stat.volatility)} · {stat.nightsPlayed} games
                    </small>
                  </span>
                  <b className={stat.totalProfit >= 0 ? 'text-green-700' : 'text-rose-700'}>
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
                Profit distribution ({scopeLabel(filters, seasonIds).toLowerCase()})
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

          <section>
            <h2 className="text-xl font-black mb-4">Season snapshot</h2>
            <div className="card p-6 md:p-8">
              <p className="text-sm text-gray-700 mb-4">
                Profit distribution ({snapshotFilters.season.map(seasonLabel).join(' + ')} · $20 nights + $10 nights)
              </p>
              <ProfitDistribution
                rows={snapshotBalance.map((stat) => ({
                  id: stat.player.id,
                  label: stat.player.displayName,
                  profit: stat.totalProfit,
                  href: `/players/${stat.player.id}?${snapshotParams}`,
                }))}
              />
            </div>
          </section>
        </>
      )}
    </>
  );
}
