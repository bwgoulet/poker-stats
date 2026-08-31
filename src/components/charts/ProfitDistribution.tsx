import Link from 'next/link';

import { dollars } from '@/lib/formatting/format';

type ProfitDistributionRow = {
  href?: string;
  id: string;
  label: string;
  profit: number;
};

export function ProfitDistribution({
  rows,
}: {
  rows: ProfitDistributionRow[];
}) {
  const maxAbsProfit = Math.max(1, ...rows.map((row) => Math.abs(row.profit)));

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const width = `${(Math.abs(row.profit) / maxAbsProfit) * 50}%`;
        const isProfit = row.profit >= 0;
        const labelClassName = row.href
          ? 'text-carolina-dark font-medium truncate'
          : 'font-medium truncate';

        return (
          <div
            className="grid grid-cols-[6rem_1fr_4.5rem] items-center gap-3 text-sm"
            key={row.id}
          >
            {row.href ? (
              <Link className={labelClassName} href={row.href}>
                {row.label}
              </Link>
            ) : (
              <span className={labelClassName}>{row.label}</span>
            )}
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
              className={`text-right font-medium ${isProfit ? 'text-black' : 'text-rose-700'}`}
            >
              {dollars(row.profit)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
