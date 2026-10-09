'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CheckCircle2, Link2 } from 'lucide-react';
import type { PlayerLinkState } from '@/lib/backend/types';

export function PlayerPageLink({ leagueId, playerId, playerName, signedIn, state }: {
  leagueId: string; playerId: string; playerName: string; signedIn: boolean; state: PlayerLinkState | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  if (!state) return null;
  const next = encodeURIComponent(`/players/${playerId}`);
  const alreadyLinked = !!state.yourPlayerId && !state.linkedToYou;
  async function changeLink() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/portal/player-links', { method: state!.linkedToYou ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leagueId, playerId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      startTransition(() => router.refresh());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update the link.'); }
    finally { setBusy(false); }
  }
  return <section className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5" aria-label="Player account link">
    <div className="flex items-start gap-3">
      {state.linkedToYou ? <CheckCircle2 size={22} className="mt-0.5 text-emerald-600" /> : <Link2 size={22} className="mt-0.5 text-carolina-dark" />}
      <div>
        <h2 className="font-bold text-navy">{state.linkedToYou ? 'Your player page' : state.linked ? 'Player page linked' : `Is this you, ${playerName}?`}</h2>
        <p className="mt-1 text-sm text-gray-600">{state.linkedToYou ? 'This page is connected to your account. Your game history stays here if you unlink it.'
          : state.linked ? 'This page belongs to another account. Contact a league admin if this needs correcting.'
            : alreadyLinked ? 'Your account is linked to another page in this league. Unlink it from your account first.'
              : 'Connect your account to this page. Your existing results and statistics stay intact.'}</p>
        {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
      </div>
    </div>
    {!signedIn ? <div className="flex gap-3 text-sm font-semibold">
      <Link href={`/auth/login?next=${next}`} className="rounded-lg bg-navy px-4 py-2 text-white">Sign in</Link>
      <Link href={`/auth/signup?next=${next}`} className="rounded-lg border px-4 py-2 text-carolina-dark">Create account</Link>
    </div> : state.linkedToYou || (!state.linked && !alreadyLinked) ? <button onClick={changeLink} disabled={busy || pending} className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy || pending ? 'Updating…' : state.linkedToYou ? 'Unlink page' : 'Link my player page'}</button>
      : <Link href="/account" className="text-sm font-semibold text-carolina-dark">Go to my account →</Link>}
  </section>;
}
