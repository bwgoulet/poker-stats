import { Player, PlayerResult, PokerNight } from '@/types/poker'; export const MIN_SAMPLE_SIZE=3;
export function reconcileNight(results:PlayerResult[]){return results.reduce((s,r)=>s+r.profit,0)}
export function leagueReconciliation(nights: PokerNight[], results: PlayerResult[]) {
  const differences = new Map(nights.map((night) => [night.id, 0]));
  for (const result of results) {
    if (!differences.has(result.nightId)) continue;
    // Use recorded cash amounts, not legacy profit overrides, and sum in cents.
    const difference = Math.round(result.cashOut * 100) - Math.round(result.buyIn * 100);
    differences.set(result.nightId, differences.get(result.nightId)! + difference);
  }
  let extraBuyInCents = 0;
  let extraCashOutCents = 0;
  let affectedGames = 0;
  for (const difference of differences.values()) {
    if (difference === 0) continue;
    affectedGames++;
    if (difference < 0) extraBuyInCents -= difference;
    else extraCashOutCents += difference;
  }
  return {
    extraBuyIn: extraBuyInCents / 100,
    extraCashOut: extraCashOutCents / 100,
    totalDiscrepancy: (extraBuyInCents + extraCashOutCents) / 100,
    affectedGames,
  };
}
export function sortResultsByDate(results:PlayerResult[], nights:PokerNight[], direction:'asc'|'desc'='asc'){const dates=new Map(nights.map(n=>[n.id,n.date])); const multiplier=direction==='asc'?1:-1; return results.slice().sort((a,b)=>(dates.get(a.nightId)??'').localeCompare(dates.get(b.nightId)??'')*multiplier);}
export function playerStats(players:Player[], nights:PokerNight[], results:PlayerResult[]){const nd=new Map(nights.map(n=>[n.id,n])); const topProfitByNight=new Map<string,number>(); for(const r of results){if(!nd.has(r.nightId))continue; const topProfit=topProfitByNight.get(r.nightId); if(topProfit===undefined||r.profit>topProfit)topProfitByNight.set(r.nightId,r.profit);} return players.map(p=>{const rs=results.filter(r=>r.playerId===p.id&&nd.has(r.nightId)); const buyIn=rs.reduce((s,r)=>s+r.buyIn,0), cashOut=rs.reduce((s,r)=>s+r.cashOut,0), profit=rs.reduce((s,r)=>s+r.profit,0); const wins=rs.filter(r=>r.profit>=0).length, champions=rs.filter(r=>nd.get(r.nightId)!.format==='tournament'?r.placement===1:r.profit===topProfitByNight.get(r.nightId)).length, losses=rs.filter(r=>r.profit<0).length, breakeven=rs.filter(r=>r.profit===0).length; const profits=rs.map(r=>r.profit).sort((a,b)=>a-b); const middle=Math.floor(profits.length/2); const medianProfit=profits.length?(profits.length%2?profits[middle]:(profits[middle-1]+profits[middle])/2):0; const nightlyReturns=rs.filter(r=>r.buyIn>0).map(r=>r.profit/r.buyIn); const meanReturn=nightlyReturns.length?nightlyReturns.reduce((sum,value)=>sum+value,0)/nightlyReturns.length:0; const volatility=nightlyReturns.length?Math.sqrt(nightlyReturns.reduce((sum,value)=>sum+(value-meanReturn)**2,0)/nightlyReturns.length):0; const sorted=rs.slice().sort((a,b)=>(nd.get(a.nightId)!.date).localeCompare(nd.get(b.nightId)!.date)); let cur=0,best=0; for(const r of sorted){ const v=r.profit>=0?1:-1; cur=cur*v>0?cur+v:v; if(Math.abs(cur)>Math.abs(best))best=cur;} return {player:p,results:rs,totalProfit:profit,totalBuyIn:buyIn,totalCashOut:cashOut,roi:buyIn?profit/buyIn:0,volatility,nightsPlayed:rs.length,wins,champions,losses,breakeven,winRate:rs.length?wins/rs.length:0,avgProfit:rs.length?profit/rs.length:0,medianProfit,avgBuyIn:rs.length?buyIn/rs.length:0,biggestWin:Math.max(0,...rs.map(r=>r.profit)),biggestLoss:Math.min(0,...rs.map(r=>r.profit)),bestStreak:best,currentStreak:cur,firstAppearance:sorted[0]?nd.get(sorted[0].nightId)!.date:undefined,lastAppearance:sorted.at(-1)?nd.get(sorted.at(-1)!.nightId)!.date:undefined};}).sort((a,b)=>b.totalProfit-a.totalProfit).map((s,i)=>({...s,rank:i+1}));}
export function leagueStats(nights:PokerNight[], results:PlayerResult[]){const by=new Map(nights.map(n=>[n.id,results.filter(r=>r.nightId===n.id)])); const pots=[...by.values()].map(rs=>rs.reduce((s,r)=>s+r.buyIn,0)); return {totalNights:nights.length,totalMoney:pots.reduce((a,b)=>a+b,0),averagePot:pots.length?pots.reduce((a,b)=>a+b,0)/pots.length:0,activePlayers:new Set(results.map(r=>r.playerId)).size,totalEntries:results.length,averageAttendance:nights.length?results.length/nights.length:0,largestPot:Math.max(0,...pots),smallestPot:pots.length?Math.min(...pots):0,mostRecentGameDate:nights.at(-1)?.date};}
export function nightStats(nights:PokerNight[], results:PlayerResult[]){return nights.map(n=>{const rs=results.filter(r=>r.nightId===n.id).sort((a,b)=>(a.placement??99)-(b.placement??99)||b.profit-a.profit); return {night:n,results:rs,players:rs.length,totalPot:rs.reduce((s,r)=>s+r.buyIn,0),winner:rs[0],largestLoss:rs.at(-1),avgBuyIn:rs.length?rs.reduce((s,r)=>s+r.buyIn,0)/rs.length:0};});}
export function recentForm(players:Player[], nights:PokerNight[], results:PlayerResult[], count=10){const recent=nights.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,count); return playerStats(players,recent,results).filter(s=>s.nightsPlayed>0).sort((a,b)=>b.totalProfit-a.totalProfit);}
