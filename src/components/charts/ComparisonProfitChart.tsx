'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const colors = ['#4b8fbd', '#13294b', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#7bafd4', '#be123c'];

export function ComparisonProfitChart({ data, players }: { data: Record<string, string | number>[]; players: { id: string; name: string }[] }) {
  if (!data.length) return <p className="py-12 text-center text-gray-500">No results in this scope.</p>;
  return <div className="h-80" aria-label="Cumulative profit comparison chart"><ResponsiveContainer><LineChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} /><Legend />{players.map((player, index) => <Line key={player.id} type="monotone" dataKey={player.id} name={player.name} stroke={colors[index % colors.length]} strokeWidth={2.5} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></div>;
}
