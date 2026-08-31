import Link from 'next/link';

import { getPokerData } from '@/lib/data/poker-repository';
import { filterNights, filterResults, parseFilters, scopeLabel } from '@/lib/filters/filter-data';
import { dateFmt, dollars } from '@/lib/formatting/format';
import { nightStats } from '@/lib/stats/statistics';

export default async function Games({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const data = getPokerData();
  const paramsString = new URLSearchParams(sp as Record<string, string>).toString();
  const rows = nightStats(
    filterNights(data.nights, filters),
    filterResults(data.results, data.nights, filters),
  ).sort((a, b) => b.night.date.localeCompare(a.night.date));

  return (
    <>
      <header>
        <p className="font-semibold text-red-600">{scopeLabel(filters)}</p>
        <h1 className="text-4xl font-black">Games</h1>
      </header>

      <div className="card overflow-hidden">
        <div
          aria-label="Games table, horizontally scrollable"
          className="overflow-x-auto"
          role="region"
          tabIndex={0}
        >
          <table className="w-full min-w-[42rem] text-sm">
            <caption className="sr-only">
              Poker games with player counts, total pots, and winners
            </caption>
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left" scope="col">
                  Date
                </th>
                <th className="p-3 text-left" scope="col">
                  Game
                </th>
                <th className="p-3 text-center" scope="col">
                  Players
                </th>
                <th className="p-3 text-right" scope="col">
                  Total pot
                </th>
                <th className="p-3 text-left" scope="col">
                  Winner
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-t" key={row.night.id}>
                  <td className="p-3">{dateFmt(row.night.date)}</td>
                  <td className="p-3">
                    <Link
                      className="font-semibold text-red-700"
                      href={`/games/${row.night.id}?${paramsString}`}
                    >
                      {row.night.title}
                    </Link>
                    <small className="block text-gray-500">
                      {row.night.seasonId} · {row.night.nightType}
                    </small>
                  </td>
                  <td className="p-3 text-center">{row.players}</td>
                  <td className="p-3 text-right tabular-nums">{dollars(row.totalPot)}</td>
                  <td className="p-3">
                    {data.players.find((player) => player.id === row.winner?.playerId)
                      ?.displayName ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
