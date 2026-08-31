'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { dollars, dateFmt } from '@/lib/formatting/format';

type SortKey = 'date' | 'players' | 'pot' | 'winner';
type Row = { id: string; date: string; title: string; seasonId: string; nightType: string; players: number; totalPot: number; winner: string };
const PAGE_SIZE = 25;

export default function GamesListing({ rows }: { rows: Row[] }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const query = searchParams.get('q') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const sort = isSortKey(searchParams.get('sort')) ? searchParams.get('sort') as SortKey : 'date';
  const direction = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const requestedPage = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const filtered = useMemo(() => rows.filter(row => {
    const needle = query.trim().toLocaleLowerCase();
    return (!needle || `${row.title} ${row.seasonId} ${row.nightType} ${row.winner}`.toLocaleLowerCase().includes(needle))
      && (!from || row.date >= from) && (!to || row.date <= to);
  }).sort((a, b) => compare(a, b, sort) * (direction === 'asc' ? 1 : -1)), [rows, query, from, to, sort, direction]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key);
    if (!('page' in changes)) next.delete('page');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }
  function changeSort(nextSort: SortKey) {
    update({ sort: nextSort, dir: sort === nextSort && direction === 'desc' ? 'asc' : 'desc' });
  }
  function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    return sort === key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';
  }

  return <div className="space-y-4">
    <form className="card p-4 grid gap-3 md:grid-cols-3" onSubmit={event => event.preventDefault()}>
      <label className="font-semibold">Search games<input className="mt-1 block w-full rounded border p-2 font-normal" type="search" value={query} onChange={event => update({ q: event.target.value })} placeholder="Game, season, type, or winner" /></label>
      <label className="font-semibold">From date<input className="mt-1 block w-full rounded border p-2 font-normal" type="date" value={from} onChange={event => update({ from: event.target.value })} /></label>
      <label className="font-semibold">To date<input className="mt-1 block w-full rounded border p-2 font-normal" type="date" value={to} onChange={event => update({ to: event.target.value })} /></label>
    </form>
    <div className="card overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr>
      <Sortable label="Date" value="date" current={sort} ariaSort={ariaSort('date')} onSort={changeSort} />
      <th className="p-3 text-left">Game</th>
      <Sortable label="Players" value="players" current={sort} ariaSort={ariaSort('players')} onSort={changeSort} />
      <Sortable label="Pot" value="pot" current={sort} ariaSort={ariaSort('pot')} onSort={changeSort} />
      <Sortable label="Winner" value="winner" current={sort} ariaSort={ariaSort('winner')} onSort={changeSort} />
    </tr></thead><tbody>{visible.map(row => <tr className="border-t" key={row.id}><td className="p-3 whitespace-nowrap">{dateFmt(row.date)}</td><td className="p-3"><Link className="font-semibold text-navy" href={`/games/${row.id}?${searchParams.toString()}`}>{row.title}</Link><small className="block text-gray-500">{row.seasonId} · {row.nightType}</small></td><td className="text-center">{row.players}</td><td className="text-center">{dollars(row.totalPot)}</td><td className="text-center">{row.winner}</td></tr>)}</tbody></table>
      {!visible.length && <p className="p-6 text-center text-gray-500">No games match these filters.</p>}
    </div>
    {pages > 1 && <nav className="flex items-center justify-between" aria-label="Games pagination"><button className="rounded border px-3 py-2 disabled:opacity-50" disabled={page === 1} onClick={() => update({ page: String(page - 1) })}>Previous</button><span>Page {page} of {pages} · {filtered.length} games</span><button className="rounded border px-3 py-2 disabled:opacity-50" disabled={page === pages} onClick={() => update({ page: String(page + 1) })}>Next</button></nav>}
  </div>;
}

function Sortable({ label, value, current, ariaSort, onSort }: { label: string; value: SortKey; current: SortKey; ariaSort: 'ascending' | 'descending' | 'none'; onSort: (sort: SortKey) => void }) {
  return <th className="p-3 text-center" aria-sort={ariaSort}><button className="font-semibold" onClick={() => onSort(value)}>{label}{current === value ? <span aria-hidden="true"> {ariaSort === 'ascending' ? '↑' : '↓'}</span> : null}</button></th>;
}
function isSortKey(value: string | null): value is SortKey { return value === 'date' || value === 'players' || value === 'pot' || value === 'winner'; }
function compare(a: Row, b: Row, sort: SortKey) {
  if (sort === 'players') return a.players - b.players;
  if (sort === 'pot') return a.totalPot - b.totalPot;
  if (sort === 'winner') return a.winner.localeCompare(b.winner);
  return a.date.localeCompare(b.date);
}
