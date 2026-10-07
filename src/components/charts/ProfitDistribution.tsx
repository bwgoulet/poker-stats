import Link from 'next/link';

import { dollars } from '@/lib/formatting/format';

type ProfitDistributionRow = {
  href?: string;
  id: string;
  label: string;
  profit: number;
  buyIn?: number;
  cashOut?: number;
};

export function ProfitDistribution({
  rows,
}: {
  rows: ProfitDistributionRow[];
}) {
  const maxAbsProfit = Math.max(1, ...rows.map((row) => Math.abs(row.profit)));
  const hasBuyAmounts = rows.some((row) => row.buyIn != null && row.cashOut != null);

  return (
    <div className={hasBuyAmounts ? 'space-y-3' : 'space-y-2'}>
      {rows.map((row) => {
        const width = `${(Math.abs(row.profit) / maxAbsProfit) * 50}%`;
        const isProfit = row.profit >= 0;
        const labelClassName = row.href
          ? 'text-carolina-dark font-medium truncate'
          : 'font-medium truncate';

        return (
          <div
            className={hasBuyAmounts
              ? 'grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_4.5rem]'
              : 'grid grid-cols-[6rem_1fr_4.5rem] items-center gap-3 text-sm'}
            key={row.id}
          >
            <div className={hasBuyAmounts ? 'col-span-2 min-w-0 sm:col-span-1' : 'min-w-0'}>
              {row.href ? (
                <Link className={`block ${labelClassName}`} href={row.href}>
                  {row.label}
                </Link>
              ) : (
                <span className={labelClassName}>{row.label}</span>
              )}
              {row.buyIn != null && row.cashOut != null && (
                <p className="mt-0.5 flex gap-1.5 whitespace-nowrap text-xs tabular-nums text-gray-500">
                  <span><span aria-label="Buy-in">In</span> {dollars(row.buyIn)}</span>
                  <span aria-hidden="true" className="text-gray-300">·</span>
                  <span><span aria-label="Cash-out">Out</span> {dollars(row.cashOut)}</span>
                </p>
              )}
            </div>
            <div className="relative h-6 overflow-hidden rounded bg-gray-100">
              <div className="absolute left-1/2 top-0 h-full w-px bg-white" />
              <div
                className={`absolute top-0 h-full rounded ${
                  isProfit ? 'left-1/2 bg-green-600' : 'right-1/2 bg-rose-600'
                }`}
                style={{ width }}
                aria-hidden="true"
              />
            </div>
            <span
              className={`text-right font-medium tabular-nums ${isProfit ? 'text-black' : 'text-rose-700'}`}
            >
              {dollars(row.profit)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
