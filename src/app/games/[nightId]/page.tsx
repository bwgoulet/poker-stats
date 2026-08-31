import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProfitDistribution } from '@/components/charts/ProfitDistribution';
import { getPokerData } from '@/lib/data/poker-repository';
import { dollars, longDateFmt } from '@/lib/formatting/format';

export default async function Game({
  params,
  searchParams,
}: {
  params: Promise<{ nightId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { nightId } = await params;
  const sp = await searchParams;
  const data = getPokerData();
  const night = data.nights.find((item) => item.id === nightId);

  if (!night) notFound();

  const paramsString = new URLSearchParams(sp as Record<string, string>).toString();
  const results = data.results
    .filter((result) => result.nightId === nightId)
    .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
  const totalPot = results.reduce((sum, result) => sum + result.buyIn, 0);
  const playerById = new Map(data.players.map((player) => [player.id, player]));

  return (
    <>
      <header>
        <p className="text-carolina-dark font-semibold">
          {night.seasonId} · {night.nightType}
        </p>
        <h1 className="text-4xl font-black">{longDateFmt(night.date)}</h1>
      </header>
      <section className="grid md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p>Total pot</p>
          <b className="text-2xl">{dollars(totalPot)}</b>
        </div>
        <div className="card p-5">
          <p>Players</p>
          <b className="text-2xl">{results.length}</b>
        </div>
        <div className="card p-5">
          <p>Winner</p>
          <b className="text-2xl">{playerById.get(results[0]?.playerId)?.displayName}</b>
        </div>
      </section>
      <section>
        <h2 className="text-xl font-black mb-4">Game balance</h2>
        <div className="card p-6 md:p-8">
          <p className="text-sm text-gray-700 mb-4">Profit distribution</p>
          <ProfitDistribution
            rows={results.map((result) => ({
              id: result.playerId,
              label: playerById.get(result.playerId)?.displayName ?? result.playerId,
              profit: result.profit,
              href: `/players/${result.playerId}?${paramsString}`,
            }))}
          />
        </div>
      </section>
      <div className="card overflow-hidden">
        <div
          aria-label="Game results table, horizontally scrollable"
          className="overflow-x-auto"
          role="region"
          tabIndex={0}
        >
          <table className="w-full min-w-[36rem]">
            <caption className="sr-only">Player results for {longDateFmt(night.date)}</caption>
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left" scope="col">
                  Place
                </th>
                <th className="p-3 text-left" scope="col">
                  Player
                </th>
                <th className="p-3 text-right" scope="col">
                  Buy-in
                </th>
                <th className="p-3 text-right" scope="col">
                  Cash-out
                </th>
                <th className="p-3 text-right" scope="col">
                  Profit
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr className="border-t" key={result.playerId}>
                  <td className="p-3">#{result.placement}</td>
                  <td className="p-3">
                    <Link
                      className="font-semibold"
                      href={`/players/${result.playerId}?${paramsString}`}
                    >
                      {playerById.get(result.playerId)?.displayName}
                    </Link>
                  </td>
                  <td className="p-3 text-right tabular-nums">{dollars(result.buyIn)}</td>
                  <td className="p-3 text-right tabular-nums">{dollars(result.cashOut)}</td>
                  <td
                    className={`p-3 text-right tabular-nums ${
                      result.profit >= 0 ? 'text-green-700' : 'text-rose-700'
                    }`}
                  >
                    {dollars(result.profit)}
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
