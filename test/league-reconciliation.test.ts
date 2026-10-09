import { describe, expect, it } from 'vitest';
import { leagueReconciliation } from '@/lib/stats/statistics';
import type { PlayerResult, PokerNight } from '@/types/poker';

const nights: PokerNight[] = ['short', 'extra', 'balanced'].map((id) => ({
  id, date: '2026-01-01', title: id, seasonId: 'spring-2026', nightType: '20',
}));
const result = (nightId: string, buyIn: number, cashOut: number): PlayerResult => ({
  nightId, playerId: 'a', buyIn, cashOut, profit: 999, sourceName: 'A',
});

describe('league reconciliation', () => {
  it('keeps opposite game discrepancies separate and uses cash amounts instead of legacy profit', () => {
    expect(leagueReconciliation(nights, [
      result('short', 50, 36.10), result('extra', 50, 63.90),
      result('balanced', 50, 60), result('balanced', 50, 40),
      result('outside-league', 1000, 0),
    ])).toMatchObject({ extraBuyIn: 13.9, extraCashOut: 13.9, totalDiscrepancy: 27.8, affectedGames: 2 });
  });

  it('respects the supplied game scope', () => {
    expect(leagueReconciliation([nights[0]], [result('short', 20, 15), result('extra', 20, 30)]))
      .toMatchObject({ extraBuyIn: 5, extraCashOut: 0, totalDiscrepancy: 5, affectedGames: 1 });
  });

  it('avoids floating-point discrepancies and retains a one-cent mismatch', () => {
    expect(leagueReconciliation(nights, [result('balanced', 0.1, 0.3), result('balanced', 0.2, 0)]))
      .toMatchObject({ extraBuyIn: 0, extraCashOut: 0, totalDiscrepancy: 0, affectedGames: 0 });
    expect(leagueReconciliation(nights, [result('short', 0.3, 0.29)]).extraBuyIn).toBe(0.01);
  });

  it('lists only affected games newest first with their signed cash discrepancies', () => {
    const datedNights = nights.map((night, index) => ({ ...night, date: `2026-01-0${index + 1}` }));
    const stats = leagueReconciliation(datedNights, [
      result('short', 50, 36.10), result('extra', 50, 63.90), result('balanced', 50, 50),
    ]);
    expect(stats.games).toEqual([
      { night: datedNights[1], difference: 13.9 },
      { night: datedNights[0], difference: -13.9 },
    ]);
    expect(stats.games.reduce((sum, game) => sum + Math.abs(game.difference), 0)).toBe(stats.totalDiscrepancy);
    expect(leagueReconciliation([], []).games).toEqual([]);
  });

  it('returns zero totals for an empty league', () => {
    expect(leagueReconciliation([], []))
      .toMatchObject({ extraBuyIn: 0, extraCashOut: 0, totalDiscrepancy: 0, affectedGames: 0 });
  });
});
