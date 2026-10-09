import { getPortalData, portalToPokerData } from '@/lib/backend/repository';
import type { PlayerLink } from '@/lib/backend/types';
import { playerStats, sortResultsByDate } from '@/lib/stats/statistics';
import { dollars, pct, dateFmt, streakLabel } from '@/lib/formatting/format';
import { ProfitTimeline } from '@/components/charts/ProfitTimeline';
export async function MyPlayerProfile({ link }: { link: PlayerLink }) {
  const portal = await getPortalData(link.leagueId);
  if (portal.selectedLeagueId !== link.leagueId) return null;
  const data = portalToPokerData(portal);
  const stats = playerStats(data.players, data.nights, data.results).find(row => row.player.id === link.playerId);
  if (!stats) return null;
  const history = sortResultsByDate(stats.results, data.nights, 'desc');
  let total = 0;
  const timeline = sortResultsByDate(stats.results, data.nights).map(row => ({ date: data.nights.find(n => n.id === row.nightId)!.date, profit: total += row.profit }));
  const highlights = [['Profit', dollars(stats.totalProfit)], ['ROI', pct(stats.roi)], ['Games played', String(stats.nightsPlayed)], ['Win rate', pct(stats.winRate)]];
  const details = [['League rank', stats.nightsPlayed ? `#${stats.rank}` : '—'], ['Total buy-in', dollars(stats.totalBuyIn)], ['Total cash-out', dollars(stats.totalCashOut)], ['Average profit', dollars(stats.avgProfit)], ['Median profit', dollars(stats.medianProfit)], ['Biggest win', dollars(stats.biggestWin)], ['Biggest loss', dollars(stats.biggestLoss)], ['Championships', String(stats.champions)], ['Current streak', streakLabel(stats.currentStreak)], ['First played', stats.firstAppearance ? dateFmt(stats.firstAppearance) : '—'], ['Last played', stats.lastAppearance ? dateFmt(stats.lastAppearance) : '—']];
  return <section className="card space-y-5 p-5 sm:p-6" aria-label={`${link.playerName} in ${link.leagueName}`}>
    <header><p className="text-sm font-semibold text-carolina-dark">{link.leagueName} · Verified player link · All time</p><h2 className="mt-1 text-2xl font-bold">{link.playerName}</h2><p className="mt-1 text-sm text-gray-500">{stats.player.aliases.length > 0 && `Also recorded as ${stats.player.aliases.join(', ')}`}</p></header>
    {stats.nightsPlayed === 0 ? <p className="text-gray-600">You’re linked. Your stats will appear after your first completed game.</p> : <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{highlights.map(([label, value]) => <div key={label} className="rounded-xl bg-carolina-light p-4"><dt className="text-sm text-gray-600">{label}</dt><dd className="mt-1 text-2xl font-bold">{value}</dd></div>)}</dl>
      <dl className="grid gap-x-6 sm:grid-cols-2">{details.map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-t py-3"><dt className="text-gray-500">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
      <div><h3 className="text-lg font-bold">Cumulative profit</h3><ProfitTimeline data={timeline} /></div>
      <div><h3 className="mb-3 text-lg font-bold">Your game history</h3><div className="max-h-96 overflow-y-auto">{history.map(row => { const game = data.nights.find(n => n.id === row.nightId)!; return <div key={row.nightId} className="flex flex-wrap justify-between gap-2 border-t py-3"><div><p className="font-semibold">{game.title}</p><p className="text-sm text-gray-500">{dateFmt(game.date)} · Buy-in {dollars(row.buyIn)} · Cash-out {dollars(row.cashOut)}</p></div><b className={row.profit >= 0 ? 'text-green-700' : 'text-rose-700'}>{dollars(row.profit)}</b></div>; })}</div></div>
    </>}
  </section>;
}
