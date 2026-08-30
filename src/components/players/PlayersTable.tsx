'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { dollars, pct } from '@/lib/formatting/format';
import { PlayerSortKey, rankPlayers } from '@/lib/stats/player-ranking';
import { playerStats } from '@/lib/stats/statistics';

type PlayerStat = ReturnType<typeof playerStats>[number];
const columns: { key: PlayerSortKey; label: string; title?: string }[] = [
  { key: 'player', label: 'Player' }, { key: 'totalProfit', label: 'Profit' }, { key: 'avgProfit', label: 'AVG Profit', title: "Average profit per game played" }, { key: 'medianProfit', label: 'Median Profit', title: "Median profit per game played" }, { key: 'roi', label: 'ROI' },
  { key: 'volatility', label: 'Volatility', title: "Standard deviation of the player's return on buy-in from night to night" },
  { key: 'nightsPlayed', label: 'Nights' }, { key: 'wins', label: 'Wins' }, { key: 'winRate', label: 'Win rate' },
];

export function PlayersTable({ rows, query }: { rows: PlayerStat[]; query: string }) {
  const [sortKey, setSortKey] = useState<PlayerSortKey>('totalProfit');
  const rankedRows = useMemo(() => rankPlayers(rows, sortKey), [rows, sortKey]);
  return <div className="card overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="bg-gray-50"><th className="p-3 text-center">Rank</th>{columns.map((column) => <th className={column.key === 'player' ? 'p-0 text-left' : 'p-0 text-center'} key={column.key} title={column.title} aria-sort={sortKey === column.key ? 'descending' : 'none'}><button className={`w-full p-3 font-semibold hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-red-700 ${column.key === 'player' ? 'text-left' : 'text-center'}`} type="button" onClick={() => setSortKey(column.key)}>{column.label}<span className={sortKey === column.key ? 'ml-1' : 'ml-1 invisible'} aria-hidden="true">↓</span></button></th>)}</tr></thead><tbody>{rankedRows.map((row, index) => <tr className="border-t" key={row.player.id}><td className="text-center">#{index + 1}</td><td className="p-3"><Link className="font-semibold text-red-700" href={`/players/${row.player.id}${query ? `?${query}` : ''}`}>{row.player.displayName}</Link></td><td className="text-center">{dollars(row.totalProfit)}</td><td className="text-center">{dollars(row.avgProfit)}</td><td className="text-center">{dollars(row.medianProfit)}</td><td className="text-center">{pct(row.roi)}</td><td className="text-center">{pct(row.volatility)}</td><td className="text-center">{row.nightsPlayed}</td><td className="text-center">{row.wins}</td><td className="text-center">{pct(row.winRate)}</td></tr>)}</tbody></table></div>;
}
