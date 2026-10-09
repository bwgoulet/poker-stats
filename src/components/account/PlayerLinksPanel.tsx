'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CheckCircle2, ExternalLink, Link2 } from 'lucide-react';
import type { League, ManagedPlayer, PlayerLink } from '@/lib/backend/types';

export function PlayerLinksPanel({ league, players, links }: { league: League | null; players: ManagedPlayer[]; links: PlayerLink[] }) {
  const router = useRouter();
  const [selection, setSelection] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const activeLink = links.find(link => link.leagueId === league?.id);
  const disabled = busy || pending;
  async function update(leagueId: string, playerId: string, unlink = false) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/portal/player-links', { method: unlink ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leagueId, playerId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSelection(''); setNotice(unlink ? 'Player page unlinked. Its game history is preserved.' : 'Player page linked to your account.');
      startTransition(() => router.refresh());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update the link.'); }
    finally { setBusy(false); }
  }
  async function openPage(link: PlayerLink) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/portal/selection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leagueId: link.leagueId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign(`/players/${encodeURIComponent(link.playerId)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to open the player page.'); setBusy(false); }
  }
  return <div className="space-y-5">
    <section className="card p-5 sm:p-6" aria-labelledby="my-player-pages">
      <div className="flex items-center gap-2"><Link2 size={20} className="text-carolina-dark" /><h2 id="my-player-pages" className="text-xl font-bold text-navy">My player pages</h2></div>
      <p className="mt-2 text-sm text-gray-600">Link one page per league. Each page can belong to one account. Linking keeps your existing game history and statistics.</p>
      {links.length === 0 ? <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-gray-500">You haven’t linked a player page yet. Choose your name below to get started.</div>
        : <ul className="mt-4 divide-y">
          {links.map(link => <li key={link.leagueId} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3"><CheckCircle2 size={20} className="text-emerald-600" /><div><p className="font-bold text-navy">{link.playerName}</p><p className="text-sm text-gray-500">{link.leagueName}{!link.accessible && ' · Access restricted'}</p></div></div>
            <div className="flex gap-3 text-sm font-semibold">
              {link.accessible && <button disabled={disabled} onClick={() => openPage(link)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-carolina-dark disabled:opacity-50">View page <ExternalLink size={14} /></button>}
              <button disabled={disabled} onClick={() => update(link.leagueId, link.playerId, true)} className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50">Unlink</button>
            </div>
          </li>)}
        </ul>}
    </section>
    {league && <section className="card p-5 sm:p-6" aria-labelledby="link-player-page">
      <p className="text-xs font-bold uppercase tracking-wider text-carolina-dark">{league.name}</p>
      <h2 id="link-player-page" className="mt-1 text-xl font-bold text-navy">{activeLink ? 'You’re connected' : 'Find your player page'}</h2>
      {activeLink ? <p className="mt-2 text-sm text-gray-600">Your account is linked to {activeLink.playerName} in this league. To change pages, unlink the current page above.</p>
        : players.length === 0 ? <p className="mt-2 text-sm text-gray-600">There are no player pages in this league yet. A league admin can add yours.</p>
          : <form onSubmit={event => { event.preventDefault(); if (selection) void update(league.id, selection); }} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 text-sm font-semibold"><label htmlFor="account-player-page">Player page</label><select id="account-player-page" required value={selection} onChange={event => setSelection(event.target.value)} disabled={disabled} className="mt-1 block w-full rounded-lg border bg-white p-3 font-normal">
              <option value="">Select your name</option>{[...players].sort((a, b) => a.displayName.localeCompare(b.displayName)).map(player => <option key={player.id} value={player.id}>{player.displayName}</option>)}
            </select></div>
            <button disabled={disabled || !selection} className="rounded-lg bg-navy px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{disabled ? 'Updating…' : 'Link my page'}</button>
          </form>}
      <p className="mt-4 text-xs text-gray-500">Only link your own page. Confirm your email first. Use the league selector to connect pages in other leagues. If your page is already claimed, contact a league admin.</p>
    </section>}
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
  </div>;
}
