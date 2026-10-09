'use client';
import Link from 'next/link';
import { useState } from 'react';
import { accountReturnTo } from '@/lib/backend/account';

export default function LoginForm({ configured, next }: { configured: boolean; next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/portal/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: values.get('email'), password: values.get('password') }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign(accountReturnTo(next));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in. Try again.'); setBusy(false); }
  }
  return <form onSubmit={login} className="space-y-4">
    {!configured && <p className="rounded-lg border bg-carolina-light p-3 text-sm">League sign-in is available once Supabase is connected.</p>}
    <label className="block font-semibold">Email<input required name="email" type="email" autoComplete="username" className="mt-1 block w-full rounded-lg border bg-white p-3 font-normal" disabled={!configured || busy} /></label>
    <label className="block font-semibold">Password<input required name="password" type="password" autoComplete="current-password" className="mt-1 block w-full rounded-lg border bg-white p-3 font-normal" disabled={!configured || busy} /></label>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <button disabled={!configured || busy} className="w-full rounded-lg bg-navy p-3 font-bold text-white disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
    <p className="text-sm text-gray-600">New here? <Link className="font-semibold text-carolina-dark" href={`/auth/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></p>
    <p className="text-xs text-gray-500">For a password reset, contact your league administrator.</p>
    <Link className="block text-sm font-semibold text-carolina-dark" href="/players">Browse players</Link>
  </form>;
}
