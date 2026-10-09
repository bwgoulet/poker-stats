import Link from 'next/link';
import { ShieldCheck, UserRound } from 'lucide-react';
import { DiscordSignIn } from '@/components/account/DiscordSignIn';
import { PlayerLinksPanel } from '@/components/account/PlayerLinksPanel';
import { LinkReviewQueue } from '@/components/account/LinkReviewQueue';
import { MyPlayerProfile } from '@/components/account/MyPlayerProfile';
import { getMyPlayerLinks, getPortalData } from '@/lib/backend/repository';
import { getAccountLinkRequests } from '@/lib/backend/link-requests';
import { canAdmin, canEdit } from '@/lib/backend/types';
export const dynamic = 'force-dynamic';
export default async function AccountPage() {
  const [portal, links, account] = await Promise.all([getPortalData(), getMyPlayerLinks(), getAccountLinkRequests()]);
  const league = portal.leagues.find(row => row.id === portal.selectedLeagueId) ?? null;
  const reviewer = portal.user?.role === 'admin' || portal.leagues.some(row => canAdmin(row.role));
  const mine = account.requests.filter(row => row.user_id === portal.user?.id);
  return <div className="mx-auto w-full max-w-4xl space-y-6">
    <header><p className="font-semibold text-carolina-dark">Your poker account</p><h1 className="mt-1 text-3xl font-black text-navy sm:text-4xl">My account</h1><p className="mt-2 text-gray-600">Your player profiles across every league.</p></header>
    {!portal.user ? <section className="card p-6 sm:p-8">
      <UserRound size={28} className="text-carolina-dark" /><h2 className="mt-3 text-2xl font-bold text-navy">Take your seat</h2>
      <p className="mt-2 text-gray-600">Use your Discord account to sign in or create an account in one step. Then choose your league and player page, or continue with no link.</p>
      <div className="mt-5 max-w-sm"><DiscordSignIn configured={portal.configured} /></div>
      {portal.configured ? <p className="mt-4 text-sm text-gray-600">Prefer email? <Link href="/auth/login" className="font-semibold text-carolina-dark">Sign in</Link> or <Link href="/auth/signup" className="font-semibold text-carolina-dark">create an account</Link>.</p> : <Link className="mt-4 inline-block font-semibold text-carolina-dark" href="/manage">Account service setup</Link>}
    </section> : <>
      <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6" aria-label="Account profile">
        <div className="flex min-w-0 items-center gap-4"><div className="rounded-full bg-carolina-light p-3"><UserRound size={24} className="text-carolina-dark" /></div><div className="min-w-0"><h2 className="truncate text-xl font-bold text-navy">{portal.user.displayName}</h2><p className="break-all text-sm text-gray-500">{portal.user.email}</p></div></div>
        <div className="flex items-center gap-2 rounded-full border bg-gray-50 px-3 py-1.5 text-sm font-semibold text-navy">{portal.user.role === 'admin' && <ShieldCheck size={16} />}{portal.user.role === 'admin' ? 'Admin' : 'Player'}</div>
      </section>
      {(portal.user.role === 'admin' || (league && canEdit(league.role))) && <Link href="/manage" className="block rounded-xl border border-carolina/40 bg-carolina-light p-4 font-semibold text-navy">Record games and manage your league</Link>}
      {links.filter(link => link.accessible).map(link => <MyPlayerProfile key={link.leagueId} link={link} />)}
      <PlayerLinksPanel key={league?.id ?? 'no-league'} league={league} leagues={portal.leagues} players={portal.players} links={links} requests={mine} choice={account.choice} />
      {reviewer && <LinkReviewQueue requests={account.requests.filter(row => row.status === 'pending')} userId={portal.user.id} />}
    </>}
  </div>;
}
