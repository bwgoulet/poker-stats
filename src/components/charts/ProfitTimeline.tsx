'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dateFmt, dollars } from '@/lib/formatting/format';

type TimelinePoint = { date: string; profit: number };

export function ProfitTimeline({ data }: { data: TimelinePoint[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-gray-500" role="status">
        No game history is available for the selected filters.
      </p>
    );
  }

  const first = data[0];
  const last = data[data.length - 1];

  return (
    <>
      <div className="h-72" aria-hidden="true">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 8, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={dateFmt} minTickGap={24} />
            <YAxis tickFormatter={(value: number) => dollars(value)} width={84} />
            <Tooltip
              labelFormatter={(label) => dateFmt(String(label))}
              formatter={(value) => [dollars(Number(value)), 'Cumulative profit']}
            />
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
            <Line
              dataKey="profit"
              name="Cumulative profit"
              stroke="#dc2626"
              strokeWidth={2}
              dot={data.length < 20}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-gray-600">
        From {dateFmt(first.date)} to {dateFmt(last.date)}, cumulative profit changed from{' '}
        {dollars(first.profit)} to {dollars(last.profit)} across {data.length}{' '}
        {data.length === 1 ? 'game' : 'games'}.
      </p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold">View timeline as a table</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <thead><tr><th className="py-2">Date</th><th className="py-2 text-right">Cumulative profit</th></tr></thead>
            <tbody>
              {data.map((point, index) => (
                <tr className="border-t" key={`${point.date}-${index}`}>
                  <td className="py-2">{dateFmt(point.date)}</td>
                  <td className="py-2 text-right">{dollars(point.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
