'use client';

import Link from 'next/link';
import { CircleHelp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { navigationStartEvent } from '@/components/layout/NavigationLoader';
import { dollars, ordinal, pct } from '@/lib/formatting/format';
import { PlayerSortKey, rankPlayers } from '@/lib/stats/player-ranking';
import { playerStats } from '@/lib/stats/statistics';
import { MIN_CLASSIFICATION_NIGHTS, PLAYER_TYPE_DESCRIPTIONS, PlayerClassification } from '@/lib/stats/player-classification';

type PlayerStat = ReturnType<typeof playerStats>[number] & { classification: PlayerClassification };
type PlayerColumn = { key: PlayerSortKey; label: string; description: string };

const columns: PlayerColumn[] = [
  { key: 'player', label: 'Player', description: 'The player whose results are summarized in this row.' },
  { key: 'totalProfit', label: 'Profit', description: 'Total cash-out minus total buy-in across all nights played.' },
  { key: 'avgProfit', label: 'AVG Profit', description: 'Average profit per night played.' },
  { key: 'roi', label: 'ROI', description: 'Total profit divided by total buy-in, shown as a percentage.' },
  { key: 'nightsPlayed', label: 'Nights', description: 'Number of game nights in which the player recorded a result.' },
  { key: 'wins', label: 'Wins', description: 'Number of nights the player finished with a profit greater than zero.' },
  { key: 'winRate', label: 'Win rate', description: 'Winning nights divided by total nights played, shown as a percentage.' },
];

const typeColumn: PlayerColumn = { key: 'type', label: 'Type', description: 'Player archetype based on relative buy-in intensity and outcome swings.' };
const classificationColumns: PlayerColumn[] = [
  { key: 'buyInIntensity', label: 'Buy-in Intensity', description: 'Average amount bought in per qualifying night, expressed in multiples of that night’s nominal buy-in.' },
  { key: 'outcomeSwing', label: 'Outcome Swing', description: 'Typical variation in normalized nightly profit, expressed in nominal buy-ins using a robust standard deviation estimate.' },
];
const tooltipColumns = new Set<PlayerSortKey>(['type', 'buyInIntensity', 'outcomeSwing', 'roi']);

export function PlayersTable({ rows, query }: { rows: PlayerStat[]; query: string }) {
  const [sortKey, setSortKey] = useState<PlayerSortKey>('totalProfit');
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();
  const rankedRows = useMemo(() => rankPlayers(rows, sortKey), [rows, sortKey]);
  function compare() {
    const params = new URLSearchParams(query);
    params.delete('player');
    selected.forEach((id) => params.append('player', id));
    window.dispatchEvent(new Event(navigationStartEvent));
    router.push(`/compare?${params.toString()}`);
  }
  return <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-600">Select two or more players to compare.</p><button type="button" disabled={selected.length < 2} onClick={compare} className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300">Compare selected ({selected.length})</button></div><div className="card overflow-x-auto"><table className="w-full min-w-[1160px] text-sm"><thead><tr className="bg-gray-50"><th className="p-3 text-center">Compare</th><th className="p-3 text-center">Rank</th>{columns.slice(0, 1).map((column) => <SortableHeader column={column} sortKey={sortKey} setSortKey={setSortKey} key={column.key} />)}<SortableHeader column={typeColumn} sortKey={sortKey} setSortKey={setSortKey} />{classificationColumns.map((column) => <SortableHeader column={column} sortKey={sortKey} setSortKey={setSortKey} key={column.key} />)}{columns.slice(1).map((column) => <SortableHeader column={column} sortKey={sortKey} setSortKey={setSortKey} key={column.key} />)}</tr></thead><tbody>{rankedRows.map((row, index) => <tr className="border-t" key={row.player.id}><td className="text-center"><input type="checkbox" aria-label={`Compare ${row.player.displayName}`} checked={selected.includes(row.player.id)} onChange={() => setSelected((current) => current.includes(row.player.id) ? current.filter((id) => id !== row.player.id) : [...current, row.player.id])} /></td><td className="text-center">#{index + 1}</td><td className="p-3"><Link className="font-semibold text-red-700" href={`/players/${row.player.id}${query ? `?${query}` : ''}`}>{row.player.displayName}</Link></td><td className="px-3 py-2 text-center"><TypeTooltip classification={row.classification} playerName={row.player.displayName} /></td><td className="text-center">{buyInUnits(row.classification.averageBuyInUnits)}</td><td className="text-center">{buyInUnits(row.classification.outcomeSwing)}</td><td className="text-center">{dollars(row.totalProfit)}</td><td className="text-center">{dollars(row.avgProfit)}</td><td className="text-center">{pct(row.roi)}</td><td className="text-center">{row.nightsPlayed}</td><td className="text-center">{row.wins}</td><td className="text-center">{pct(row.winRate)}</td></tr>)}</tbody></table></div></div>;
}

function buyInUnits(value: number | null) {
  return value == null ? '—' : `${value.toFixed(2)}×`;
}

function TypeTooltip({ classification, playerName }: { classification: PlayerClassification; playerName: string }) {
  return <details className="group"><summary className="inline-block cursor-pointer list-none rounded-full bg-gray-100 px-2.5 py-1 font-semibold hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-red-700" aria-label={`Explain ${playerName}'s ${classification.type} player type`}>{classification.type}</summary><div className="mx-auto mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 text-left font-normal shadow-lg" role="tooltip"><strong className="block mb-1">What qualifies as {classification.type}?</strong><p className="text-gray-700">{PLAYER_TYPE_DESCRIPTIONS[classification.type]}</p><p className="mt-2 border-t pt-2 text-xs text-gray-500">{classificationTitle(classification)}</p></div></details>;
}

function SortableHeader({ column, sortKey, setSortKey }: { column: PlayerColumn; sortKey: PlayerSortKey; setSortKey: (key: PlayerSortKey) => void }) {
  return <th className={column.key === 'player' ? 'p-0 text-left' : 'p-0 text-center'} aria-sort={sortKey === column.key ? 'descending' : 'none'}><span className={`inline-flex items-center gap-1 p-3 ${column.key === 'player' ? 'justify-start' : 'justify-center'}`}><button className="font-semibold hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-700" type="button" onClick={() => setSortKey(column.key)}>{column.label}<span className={sortKey === column.key ? 'ml-1' : 'ml-1 invisible'} aria-hidden="true">↓</span></button>{tooltipColumns.has(column.key) && <StatTooltip id={column.key} label={column.label} description={column.description} />}</span></th>;
}

function StatTooltip({ id, label, description }: { id: string; label: string; description: string }) {
  const tooltipId = `column-${id}-description`;
  return <span className="group relative inline-flex"><button type="button" className="rounded-full text-gray-400 hover:text-red-700 focus-visible:text-red-700 focus-visible:outline-2 focus-visible:outline-red-700" aria-label={`Explain ${label}`} aria-describedby={tooltipId}><CircleHelp aria-hidden="true" size={15} strokeWidth={2.25} /></button><span id={tooltipId} role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-lg bg-gray-900 p-2.5 text-left text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block">{description}</span></span>;
}

function classificationTitle(classification: PlayerClassification) {
  if (classification.confidence === 'insufficient') return `${classification.qualifyingNights} qualifying nights; ${MINIMUM_NIGHTS_TEXT}`;
  return `Buy-in intensity: ${ordinal(classification.exposurePercentile!)} percentile · Outcome swing: ${ordinal(classification.swingPercentile!)} percentile · ${classification.qualifyingNights} qualifying nights · ${classification.confidence}`;
}

const MINIMUM_NIGHTS_TEXT = `${MIN_CLASSIFICATION_NIGHTS} required for a player type`;
