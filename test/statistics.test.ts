import { describe,it,expect } from 'vitest'; import { playerStats, reconcileNight, recentForm, sortResultsByDate } from '@/lib/stats/statistics'; import { filterNights, filterResults } from '@/lib/filters/filter-data'; import { canonicalPlayerId } from '@/lib/data/player-aliases';
const players=[{id:'a',displayName:'A',aliases:['A']},{id:'b',displayName:'B',aliases:['B']}];
const nights=Array.from({length:12},(_,i)=>({id:`n${i}`,date:`2026-01-${String(i+1).padStart(2,'0')}`,title:`N${i}`,seasonId:i<6?'fall-2025':'spring-2026',nightType:i%2?'20':'10'} as const));
const results=nights.flatMap((n,i)=>[{nightId:n.id,playerId:'a',buyIn:10,cashOut:i%3===0?20:0,profit:i%3===0?10:-10,sourceName:'A'},{nightId:n.id,playerId:'b',buyIn:10,cashOut:i%3===0?0:20,profit:i%3===0?-10:10,sourceName:'B'}]);
describe('statistics engine',()=>{it('calculates profit ROI, volatility, and win/loss',()=>{const s=playerStats(players,nights,results)[1]; expect(s.totalProfit).toBe(-40); expect(s.roi).toBeCloseTo(-40/120); expect(s.volatility).toBeCloseTo(Math.sqrt(8/9)); expect(s.wins).toBe(4); expect(s.losses).toBe(8);}); it('calculates median profit for even and odd game counts',()=>{const even=playerStats(players,nights.slice(0,4),results)[1]; const odd=playerStats(players,nights.slice(0,3),results)[1]; expect(even.medianProfit).toBe(0); expect(odd.medianProfit).toBe(-10);}); it('filters season night type and combined',()=>{expect(filterNights(nights,{season:['spring-2026'],nightType:['10','20','50','one-off'],minNights:3})).toHaveLength(6); expect(filterNights(nights,{season:['fall-2025','spring-2026'],nightType:['20'],minNights:3})).toHaveLength(6); expect(filterResults(results,nights,{season:['spring-2026'],nightType:['20'],minNights:3})).toHaveLength(6);}); it('sorts game results in descending chronological order without mutating them',()=>{const unsorted=[results[0],results[22],results[10]]; expect(sortResultsByDate(unsorted,nights,'desc').map(r=>r.nightId)).toEqual(['n11','n5','n0']); expect(unsorted.map(r=>r.nightId)).toEqual(['n0','n11','n5']);}); it('limits recent form to the last 10 table games',()=>{const recent=recentForm(players,nights,results,10); expect(recent[0].player.id).toBe('b'); expect(recent.every(stat=>stat.nightsPlayed===10)).toBe(true); expect(recent.flatMap(stat=>stat.results).some(result=>result.nightId==='n1')).toBe(false);}); it('counts a zero-profit result as a win',()=>{const zeroBuyIn=playerStats(players,[nights[0]],[{nightId:'n0',playerId:'a',buyIn:0,cashOut:0,profit:0,sourceName:'A'}])[0]; expect(zeroBuyIn.wins).toBe(1); expect(zeroBuyIn.losses).toBe(0); expect(zeroBuyIn.breakeven).toBe(1); expect(zeroBuyIn.winRate).toBe(1); expect(zeroBuyIn.roi).toBe(0); expect(zeroBuyIn.volatility).toBe(0); expect(zeroBuyIn.medianProfit).toBe(0);}); it('handles empty stats, aliases, and reconciliation',()=>{expect(playerStats(players,[],[])[0].nightsPlayed).toBe(0); expect(playerStats(players,[],[])[0].medianProfit).toBe(0); expect(canonicalPlayerId(' Aidan Pirc ')).toBe('aidan-pirc'); expect(reconcileNight(results.filter(r=>r.nightId==='n0'))).toBe(0);});});

describe('champion statistics', () => {
  it('counts each night a player is the top earner and awards tied top earners', () => {
    const tiedResults = [
      { nightId: 'n0', playerId: 'a', buyIn: 10, cashOut: 20, profit: 10, sourceName: 'A' },
      { nightId: 'n0', playerId: 'b', buyIn: 10, cashOut: 20, profit: 10, sourceName: 'B' },
      { nightId: 'n1', playerId: 'a', buyIn: 10, cashOut: 15, profit: 5, sourceName: 'A' },
      { nightId: 'n1', playerId: 'b', buyIn: 10, cashOut: 25, profit: 15, sourceName: 'B' },
    ];

    const stats = playerStats(players, nights.slice(0, 2), tiedResults);

    expect(stats.find((stat) => stat.player.id === 'a')?.champions).toBe(1);
    expect(stats.find((stat) => stat.player.id === 'b')?.champions).toBe(2);
  });
});

it('normalizes mixed stakes per game and excludes unknown blinds and tournaments', () => {
  const games = [
    { ...nights[0], id: 'ten', nightType: '10' as const },
    { ...nights[0], id: 'twenty', nightType: '20' as const },
    { ...nights[0], id: 'even', nightType: '20' as const },
    { ...nights[0], id: 'fifty', nightType: '50' as const },
    { ...nights[0], id: 'tournament', nightType: '10' as const, format: 'tournament' as const },
  ];
  const rows = games.map((n, i) => ({ nightId: n.id, playerId: 'a', buyIn: 100, cashOut: 100 + [10, -10, 0, 50, 30][i], profit: [10, -10, 0, 50, 30][i], sourceName: 'A' }));
  const stats = playerStats(players, games, rows).find(s => s.player.id === 'a')!;
  expect(stats.totalBB).toBeCloseTo(50);
  expect(stats.avgBB).toBeCloseTo(50 / 3);
  expect(stats.bbNights).toBe(3);
  expect(playerStats(players, [], [])[0].totalBB).toBeNull();
  expect(playerStats(players, [], [])[0].avgBB).toBeNull();
  const filtered = playerStats(players, games.slice(1, 3), rows).find(s => s.player.id === 'a')!;
  expect(filtered.totalBB).toBeCloseTo(-50);
  expect(filtered.avgBB).toBeCloseTo(-25);
});
