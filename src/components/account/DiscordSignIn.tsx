'use client';
import { useState } from 'react';

export function DiscordSignIn({ configured, next = '/account' }: { configured: boolean; next?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signIn() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/portal/auth/discord', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to start Discord sign-in.'); setBusy(false); }
  }
  return <div className="space-y-3">
    <button type="button" disabled={!configured || busy} onClick={signIn} className="w-full rounded-xl bg-[#5865F2] px-5 py-3 font-bold text-white hover:bg-[#4752C4] disabled:opacity-50">{busy ? 'Opening Discord…' : 'Sign in with Discord'}</button>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {!configured && <p className="text-sm text-gray-600">Discord sign-in will be available once the site administrator connects the account service.</p>}
  </div>;
}
