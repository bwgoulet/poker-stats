'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { PortalData } from '@/lib/backend/types';

type LeagueSelection = Pick<PortalData, 'configured' | 'leagues' | 'selectedLeagueId' | 'user'>;

export function LeagueSwitcher({ configured, leagues, selectedLeagueId, user }: LeagueSelection) {
  const router = useRouter();
  const pathname = usePathname();
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = leagues.find((league) => league.id === selectedLeagueId);

  async function selectLeague(leagueId: string, confirmed = false) {
    if (leagueId === selectedLeagueId || saving || pending || signingOut) return;
    if (!confirmed && !window.dispatchEvent(new CustomEvent('poker-league-switch', {
      cancelable: true, detail: { proceed: () => void selectLeague(leagueId, true) },
    }))) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/portal/selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || 'Unable to switch leagues. Please try again.');
      const destination = pathname.startsWith('/players/') ? '/players'
        : pathname.startsWith('/games/') ? '/games'
          : pathname.startsWith('/auth') ? '/dashboard' : pathname;
      startTransition(() => {
        router.replace(destination);
        router.refresh();
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to switch leagues.');
    } finally {
      setSaving(false);
    }
  }

  async function signOut(confirmed = false) {
    if (saving || pending || signingOut) return;
    if (!confirmed && !window.dispatchEvent(new CustomEvent('poker-league-switch', {
      cancelable: true, detail: { proceed: () => void signOut(true) },
    }))) return;
    setSigningOut(true);
    setError(null);
    try {
      const response = await fetch('/api/portal/auth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || 'Unable to sign out. Please try again.');
      window.location.assign('/auth/login');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out.');
      setSigningOut(false);
    }
  }

  if (!configured) {
    return <p className="mt-6 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-blue-100/75">Workbook archive · Open Manage league for database setup.</p>;
  }

  return <div className="mt-6 space-y-2">
    {leagues.length > 0 ? <>
      <label className="block text-[10px] font-bold uppercase tracking-[.18em] text-blue-100/65" htmlFor="active-league">Active league</label>
      <select
        id="active-league"
        aria-busy={saving || pending}
        className="w-full rounded-xl border border-white/20 bg-navy px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
        value={selectedLeagueId ?? ''}
        disabled={saving || pending || signingOut || leagues.length < 2}
        onChange={(event) => selectLeague(event.target.value)}
      >
        {leagues.map((league) => <option value={league.id} key={league.id}>{league.name}</option>)}
      </select>
      <p className="text-xs text-blue-100/65">{saving || pending ? 'Switching leagues…' : active?.role ? `${active.role.charAt(0).toUpperCase()}${active.role.slice(1)} access` : 'Public statistics'}</p>
    </> : <Link href="/manage" className="block rounded-xl border border-white/20 px-3 py-2.5 text-sm font-semibold text-blue-100 hover:bg-white/10">{user ? 'Create your first league' : 'Sign in to your league'}</Link>}
    {user && <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-blue-100/75"><span className="truncate" title={user.email ?? undefined}>{user.email ?? 'Signed in'}</span><button type="button" disabled={saving || pending || signingOut} onClick={() => void signOut()} className="shrink-0 rounded-lg px-2 py-1 font-semibold hover:bg-white/10 disabled:opacity-50">{signingOut ? 'Signing out…' : 'Sign out'}</button></div>}
    {error && <p className="rounded-lg bg-rose-950/30 px-3 py-2 text-xs text-rose-100" role="alert">{error}</p>}
  </div>;
}
