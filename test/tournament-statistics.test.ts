import { describe, expect, it } from 'vitest';

import { nightStats, playerStats, reconcileNight } from '@/lib/stats/statistics';
import type { Player, PlayerResult, PokerNight } from '@/types/poker';

const players: Player[] = [
  { id: 'winner', displayName: 'Winner', aliases: [] },
  { id: 'runner-up', displayName: 'Runner-up', aliases: [] },
  { id: 'third', displayName: 'Third', aliases: [] },
];

const tournament: PokerNight = {
  id: 'rebuy-tournament',
  title: 'Rebuy tournament',
  date: '2026-10-08',
  seasonId: 'fall-2026',
  nightType: '20',
  format: 'tournament',
};

const tournamentResults: PlayerResult[] = [
  { nightId: tournament.id, playerId: 'runner-up', buyIn: 20, cashOut: 80, profit: 60, placement: 2, sourceName: 'Runner-up' },
  { nightId: tournament.id, playerId: 'third', buyIn: 80, cashOut: 0, profit: -80, placement: 3, sourceName: 'Third' },
  { nightId: tournament.id, playerId: 'winner', buyIn: 100, cashOut: 120, profit: 20, placement: 1, sourceName: 'Winner' },
];

describe('tournament champions', () => {
  it('awards first place even when rebuys make the runner-up more profitable', () => {
    expect(reconcileNight(tournamentResults)).toBe(0);

    const stats = playerStats(players, [tournament], tournamentResults);

    expect(stats.find(({ player }) => player.id === 'winner')).toMatchObject({ champions: 1, totalProfit: 20 });
    expect(stats.find(({ player }) => player.id === 'runner-up')).toMatchObject({ champions: 0, totalProfit: 60 });
    expect(stats.find(({ player }) => player.id === 'third')?.champions).toBe(0);
    expect(stats[0].player.id).toBe('runner-up');
  });

  it('shows the tournament first-place finisher as the game winner', () => {
    const [game] = nightStats([tournament], tournamentResults);

    expect(game.totalPot).toBe(200);
    expect(game.winner).toMatchObject({ playerId: 'winner', placement: 1, profit: 20 });
  });

  it('keeps tied highest-profit cash players as champions regardless of recorded placement', () => {
    const cashGame: PokerNight = { ...tournament, id: 'cash-night', format: 'cash' };
    const cashResults: PlayerResult[] = [
      { nightId: cashGame.id, playerId: 'winner', buyIn: 20, cashOut: 40, profit: 20, placement: 2, sourceName: 'Winner' },
      { nightId: cashGame.id, playerId: 'runner-up', buyIn: 40, cashOut: 60, profit: 20, placement: 3, sourceName: 'Runner-up' },
      { nightId: cashGame.id, playerId: 'third', buyIn: 40, cashOut: 0, profit: -40, placement: 1, sourceName: 'Third' },
    ];

    expect(reconcileNight(cashResults)).toBe(0);

    const stats = playerStats(players, [cashGame], cashResults);

    expect(stats.find(({ player }) => player.id === 'winner')?.champions).toBe(1);
    expect(stats.find(({ player }) => player.id === 'runner-up')?.champions).toBe(1);
    expect(stats.find(({ player }) => player.id === 'third')?.champions).toBe(0);
  });
});
