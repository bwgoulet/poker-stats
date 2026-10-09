'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { LinkRequest } from '@/lib/backend/link-requests';
export function LinkReviewQueue({ requests, userId }: { requests: LinkRequest[]; userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  async function review(requestId: string, approve: boolean) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/portal/link-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, approve }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      startTransition(() => router.refresh());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to review request.'); }
    finally { setBusy(false); }
  }
  return <section className="card p-6" aria-labelledby="verify-player-links">
    <h2 id="verify-player-links" className="text-xl font-bold">Verify player links</h2>
    <p className="mt-2 text-sm text-gray-600">Confirm that the account belongs to this player before approving. Linking does not grant league management access.</p>
    {requests.length === 0 && <p className="mt-4 text-gray-500">No player links need review.</p>}
    <ul className="mt-4 divide-y">{requests.map(request => <li key={request.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div><p className="font-semibold">{request.account_name} wants to link to {request.player_name}</p><p className="text-sm text-gray-500">{request.league_name} · {new Date(request.created_at).toISOString().slice(0, 10)}</p><p className="mt-1 break-all text-sm text-gray-500">{request.discord_id ? `Discord user ID: ${request.discord_id}` : `Account ID: ${request.user_id}`}</p></div>
      {request.user_id === userId ? <p className="text-sm text-gray-500">Another administrator must review your claim.</p> : <div className="flex gap-2">
        <button disabled={busy || pending} onClick={() => review(request.id, true)} className="rounded-lg bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50">Approve</button>
        <button disabled={busy || pending} onClick={() => review(request.id, false)} className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">Reject</button>
      </div>}
    </li>)}</ul>
    {error && <p role="alert" className="mt-3 text-rose-700">{error}</p>}
  </section>;
}
