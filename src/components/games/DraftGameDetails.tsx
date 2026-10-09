import Link from 'next/link';
import type { ManagedGame, ManagedPlayer } from '@/lib/backend/types';
import { dollars, longDateFmt } from '@/lib/formatting/format';

export default function DraftGameDetails({ game, players, editable }: {
  game: ManagedGame; players: ManagedPlayer[]; editable: boolean;
}) {
  const names = new Map(players.map(player => [player.id, player.displayName]));
  const results = [...game.results].sort((a, b) => (a.placement ?? Infinity) - (b.placement ?? Infinity));
  return <>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-carolina-dark text-sm font-semibold">{game.seasonId} · {game.nightType} · Draft</p>
        <h1 className="text-4xl font-black">{game.title}</h1>
        <p>{longDateFmt(game.date)}</p>
      </div>
      {editable && <Link href={`/manage?gameId=${encodeURIComponent(game.id)}`} className="rounded-lg bg-carolina-dark px-5 py-2.5 text-sm font-bold text-white">Edit game</Link>}
    </header>
    <p className="rounded-lg bg-amber-50 p-4 text-amber-900">This game is a draft. Results are provisional and do not count toward standings or statistics.</p>
    <section className="grid gap-4 md:grid-cols-3">
      <div className="card p-5"><p>Total pot</p><b className="text-2xl">{dollars(game.results.reduce((sum, row) => sum + row.buyInCents, 0) / 100)}</b></div>
      <div className="card p-5"><p>Players</p><b className="text-2xl">{results.length}</b></div>
      <div className="card p-5"><p>Winner</p><b className="text-2xl">Pending</b></div>
    </section>
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[36rem]">
        <caption className="sr-only">Draft results for {game.title}</caption>
        <thead className="bg-gray-50"><tr>
          <th className="p-3 text-left" scope="col">Place</th><th className="p-3 text-left" scope="col">Player</th>
          <th className="p-3 text-right" scope="col">Buy-in</th><th className="p-3 text-right" scope="col">Cash-out</th><th className="p-3 text-right" scope="col">Profit</th>
        </tr></thead>
        <tbody>{results.map(row => <tr className="border-t" key={row.playerId}>
          <td className="p-3">{row.placement == null ? 'Pending' : `#${row.placement}`}</td>
          <td className="p-3"><Link className="font-semibold" href={`/players/${row.playerId}`}>{names.get(row.playerId) ?? row.playerId}</Link></td>
          <td className="p-3 text-right tabular-nums">{dollars(row.buyInCents / 100)}</td>
          <td className="p-3 text-right tabular-nums">{row.cashOutCents == null ? 'Pending' : dollars(row.cashOutCents / 100)}</td>
          <td className="p-3 text-right tabular-nums">{row.cashOutCents == null ? 'Pending' : dollars((row.legacyProfitCents ?? row.cashOutCents - row.buyInCents) / 100)}</td>
        </tr>)}</tbody>
      </table>
      {!results.length && <p className="p-6 text-center text-gray-500">No results entered yet.</p>}
    </div>
  </>;
}
