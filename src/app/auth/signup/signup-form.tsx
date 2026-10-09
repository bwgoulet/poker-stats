'use client';
import Link from 'next/link';
import { useState } from 'react';
import { accountReturnTo } from '@/lib/backend/account';

export default function SignupForm({ configured, next }: { configured: boolean; next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  async function signup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/portal/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        email: values.get('email'), password: values.get('password'), displayName: values.get('displayName'), next,
      }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.signedIn) { window.location.assign(accountReturnTo(next)); return; }
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create your account. Try again.'); }
    finally { setBusy(false); }
  }
  if (sent) return <div className="space-y-4">
    <div role="status" className="rounded-xl border border-carolina/40 bg-carolina-light p-4">
      <h2 className="font-bold text-navy">Check your email</h2>
      <p className="mt-2 text-sm text-gray-700">If this address can be registered, you’ll receive a confirmation link. Confirm your email, then sign in to link your player page. If you already have an account, sign in below.</p>
    </div>
    <Link className="block rounded-lg bg-navy p-3 text-center font-bold text-white" href={`/auth/login?next=${encodeURIComponent(next)}`}>Continue to sign in</Link>
  </div>;
  const input = 'mt-1 block w-full rounded-lg border bg-white p-3 font-normal';
  return <form onSubmit={signup} className="space-y-4">
    {!configured && <p className="rounded-lg border bg-carolina-light p-3 text-sm">Account creation is available once Supabase is connected.</p>}
    <label className="block font-semibold">Display name<input required name="displayName" maxLength={100} autoComplete="nickname" className={input} disabled={!configured || busy} /></label>
    <label className="block font-semibold">Email<input required name="email" type="email" maxLength={320} autoComplete="email" className={input} disabled={!configured || busy} /></label>
    <label className="block font-semibold">Password<input required name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" aria-describedby="password-hint" className={input} disabled={!configured || busy} /></label>
    <p id="password-hint" className="text-xs text-gray-500">Use at least 8 characters.</p>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <button disabled={!configured || busy} className="w-full rounded-lg bg-navy p-3 font-bold text-white disabled:opacity-50">{busy ? 'Creating account…' : 'Create account'}</button>
    <p className="text-sm text-gray-600">Already have an account? <Link className="font-semibold text-carolina-dark" href={`/auth/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
  </form>;
}
