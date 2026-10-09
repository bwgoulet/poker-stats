import Link from 'next/link';
import { dateFmt, dollars } from '@/lib/formatting/format';
import type { leagueReconciliation } from '@/lib/stats/statistics';

export function ReconciliationCard({ reconciliation }: {
  reconciliation: ReturnType<typeof leagueReconciliation>;
}) {
  return (
    <section className="card p-5" aria-labelledby="reconciliation-heading">
      <h2 id="reconciliation-heading" className="text-sm font-semibold text-gray-600">
        Reconciliation discrepancies · All-time league
      </h2>
      <p className="mt-1 text-2xl font-black">{dollars(reconciliation.totalDiscrepancy)}</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-gray-600">Extra bought in (buy-ins exceed cash-outs)</dt>
          <dd className="font-bold tabular-nums">{dollars(reconciliation.extraBuyIn)}</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-600">Extra bought out (cash-outs exceed buy-ins)</dt>
          <dd className="font-bold tabular-nums">{dollars(reconciliation.extraCashOut)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-gray-500">
        Sum of each game's buy-in/cash-out mismatch across {reconciliation.affectedGames} completed
        {reconciliation.affectedGames === 1 ? ' game' : ' games'}. Covers all seasons and night types,
        regardless of filters. Recorded discrepancies do not necessarily represent money lost.
      </p>
      {reconciliation.games.length > 0 ? (
        <details className="mt-4 border-t pt-3">
          <summary className="cursor-pointer rounded font-semibold text-carolina-dark focus-visible:outline-2 focus-visible:outline-offset-4">
            View affected games ({reconciliation.affectedGames})
          </summary>
          <ul className="mt-3 max-h-96 overflow-y-auto">
            {reconciliation.games.map(({ night, difference }) => (
              <li key={night.id} className="border-t first:border-t-0">
                <Link href={`/games/${night.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded py-3 hover:bg-gray-50 focus-visible:outline-2">
                  <span>
                    <span className="font-semibold">{night.title}</span>
                    <span className="block text-sm text-gray-500">{dateFmt(night.date)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold tabular-nums">{dollars(Math.abs(difference))}</span>
                    <span className="block text-sm text-gray-600">{difference < 0 ? 'Extra bought in' : 'Extra bought out'}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="mt-4 border-t pt-3 text-sm text-gray-500">All completed games balance.</p>
      )}
    </section>
  );
}
