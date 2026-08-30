'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { dollars, pct } from '@/lib/formatting/format';
import { PlayerSortKey, rankPlayers } from '@/lib/stats/player-ranking';
import { playerStats } from '@/lib/stats/statistics';
import { PlayerClassification } from '@/lib/stats/player-classification';

type PlayerStat = ReturnType<typeof playerStats>[number] & { classification: PlayerClassification };
const columns: { key: PlayerSortKey; label: string; title?: string }[] = [
  { key: 'player', label: 'Player' }, { key: 'totalProfit', label: 'Profit' }, { key: 'avgProfit', label: 'AVG Profit', title: "Average profit per game played" }, { key: 'medianProfit', label: 'Median Profit', title: "Median profit per game played" }, { key: 'roi', label: 'ROI' },
  { key: 'volatility', label: 'Volatility', title: "Standard deviation of the player's return on buy-in from night to night" },
  { key: 'nightsPlayed', label: 'Nights' }, { key: 'wins', label: 'Wins' }, { key: 'winRate', label: 'Win rate' },
];

export function PlayersTable({ rows, query }: { rows: PlayerStat[]; query: string }) {
  const [sortKey, setSortKey] = useState<PlayerSortKey>('totalProfit');
  const rankedRows = useMemo(() => rankPlayers(rows, sortKey), [rows, sortKey]);
  return <div className="card overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="bg-gray-50"><th className="p-3 text-center">Rank</th>{columns.slice(0, 1).map((column) => <SortableHeader column={column} sortKey={sortKey} setSortKey={setSortKey} key={column.key} />)}<th className="p-3 text-center" title="Relative player archetype based on buy-in intensity and outcome swings">Type</th>{columns.slice(1).map((column) => <SortableHeader column={column} sortKey={sortKey} setSortKey={setSortKey} key={column.key} />)}</tr></thead><tbody>{rankedRows.map((row, index) => <tr className="border-t" key={row.player.id}><td className="text-center">#{index + 1}</td><td className="p-3"><Link className="font-semibold text-red-700" href={`/players/${row.player.id}${query ? `?${query}` : ''}`}>{row.player.displayName}</Link></td><td className="px-3 text-center"><span className="inline-block rounded-full bg-gray-100 px-2.5 py-1 font-semibold" title={classificationTitle(row.classification)}>{row.classification.type}</span></td><td className="text-center">{dollars(row.totalProfit)}</td><td className="text-center">{dollars(row.avgProfit)}</td><td className="text-center">{dollars(row.medianProfit)}</td><td className="text-center">{pct(row.roi)}</td><td className="text-center">{pct(row.volatility)}</td><td className="text-center">{row.nightsPlayed}</td><td className="text-center">{row.wins}</td><td className="text-center">{pct(row.winRate)}</td></tr>)}</tbody></table></div>;
}

function SortableHeader({ column, sortKey, setSortKey }: { column: typeof columns[number]; sortKey: PlayerSortKey; setSortKey: (key: PlayerSortKey) => void }) {
  return <th className={column.key === 'player' ? 'p-0 text-left' : 'p-0 text-center'} title={column.title} aria-sort={sortKey === column.key ? 'descending' : 'none'}><button className={`w-full p-3 font-semibold hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-red-700 ${column.key === 'player' ? 'text-left' : 'text-center'}`} type="button" onClick={() => setSortKey(column.key)}>{column.label}<span className={sortKey === column.key ? 'ml-1' : 'ml-1 invisible'} aria-hidden="true">↓</span></button></th>;
}

function classificationTitle(classification: PlayerClassification) {
  if (classification.confidence === 'insufficient') return `${classification.qualifyingNights} qualifying nights; ${MINIMUM_NIGHTS_TEXT}`;
  return `Buy-in intensity: ${classification.exposurePercentile?.toFixed(0)}th percentile · Outcome swing: ${classification.swingPercentile?.toFixed(0)}th percentile · ${classification.qualifyingNights} qualifying nights · ${classification.confidence}`;
}

const MINIMUM_NIGHTS_TEXT = '8 required for a player type';
