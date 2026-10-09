import Link from 'next/link';
import { ShieldCheck, UserRound } from 'lucide-react';
import { PlayerLinksPanel } from '@/components/account/PlayerLinksPanel';
import { getMyPlayerLinks, getPortalData } from '@/lib/backend/repository';
import { canEdit } from '@/lib/backend/types';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const [portal, links] = await Promise.all([getPortalData(), getMyPlayerLinks()]);
  const league = portal.leagues.find(row => row.id === portal.selectedLeagueId) ?? null;
  return <div className="mx-auto w-full max-w-4xl space-y-6">
    <header><p className="font-semibold text-carolina-dark">Your poker account</p><h1 className="mt-1 text-3xl font-black text-navy sm:text-4xl">My account</h1><p className="mt-2 text-gray-600">One account. Your player pages across every league.</p></header>
    {!portal.configured ? <section className="card p-6"><h2 className="text-xl font-bold">Connect Supabase to get started</h2><p className="mt-2 text-gray-600">Accounts and player-page linking become available once the database is connected.</p><Link className="mt-4 inline-block font-semibold text-carolina-dark" href="/manage">Open database setup →</Link></section>
      : !portal.user ? <section className="card p-6 sm:p-8"><UserRound size={28} className="text-carolina-dark" /><h2 className="mt-3 text-2xl font-bold text-navy">Take your seat</h2><p className="mt-2 text-gray-600">Create an account and connect it to your existing player pages. All your recorded games stay intact.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/auth/signup" className="rounded-lg bg-navy px-5 py-3 font-bold text-white">Create account</Link><Link href="/auth/login" className="rounded-lg border px-5 py-3 font-semibold text-carolina-dark">Sign in</Link></div></section>
        : <>
          <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6" aria-label="Account profile">
            <div className="flex min-w-0 items-center gap-4"><div className="rounded-full bg-carolina-light p-3"><UserRound size={24} className="text-carolina-dark" /></div><div className="min-w-0"><h2 className="truncate text-xl font-bold text-navy">{portal.user.displayName}</h2><p className="break-all text-sm text-gray-500">{portal.user.email}</p></div></div>
            <div className="flex items-center gap-2 rounded-full border bg-gray-50 px-3 py-1.5 text-sm font-semibold text-navy">{portal.user.role === 'admin' && <ShieldCheck size={16} />}{portal.user.role === 'admin' ? 'Admin' : 'Player'}</div>
          </section>
          {(portal.user.role === 'admin' || (league && canEdit(league.role))) && <Link href="/manage" className="flex items-center justify-between rounded-xl border border-carolina/40 bg-carolina-light p-4 font-semibold text-navy"><span>Record games and manage your league</span><span aria-hidden>→</span></Link>}
          <PlayerLinksPanel key={league?.id ?? 'no-league'} league={league} players={portal.players} links={links} />
        </>}
  </div>;
}
