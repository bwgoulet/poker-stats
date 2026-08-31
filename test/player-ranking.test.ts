import { describe, expect, it } from 'vitest';
import { rankPlayers } from '@/lib/stats/player-ranking';

const rows = [
  { player: { displayName: 'Alice' }, totalProfit: 100, avgProfit: 50, medianProfit: 40, roi: 0.5, volatility: 0.2, nightsPlayed: 2, wins: 1, winRate: 0.5 },
  { player: { displayName: 'Zoe' }, totalProfit: 50, avgProfit: 12.5, medianProfit: 60, roi: 1, volatility: 0.7, nightsPlayed: 4, wins: 3, winRate: 0.75 },
];

describe('player rankings', () => {
  it('ranks numeric columns greatest-to-lowest without mutating the source rows', () => {
    expect(rankPlayers(rows, 'roi').map((row) => row.player.displayName)).toEqual(['Zoe', 'Alice']);
    expect(rows.map((row) => row.player.displayName)).toEqual(['Alice', 'Zoe']);
  });

  it('ranks player names in descending alphabetical order', () => {
    expect(rankPlayers(rows, 'player').map((row) => row.player.displayName)).toEqual(['Zoe', 'Alice']);
  });

  it('ranks players by average profit', () => {
    expect(rankPlayers(rows, 'avgProfit').map((row) => row.player.displayName)).toEqual(['Alice', 'Zoe']);
  });

  it('ranks players by median profit', () => {
    expect(rankPlayers(rows, 'medianProfit').map((row) => row.player.displayName)).toEqual(['Zoe', 'Alice']);
  });

  it('ranks player types from Maniac to insufficient history', () => {
    const typedRows = ['NIT', 'Neutral', 'One-Bullet', 'Insufficient history', 'Gambler', 'Steady', 'Maniac', 'Action Player']
      .map((type, index) => ({
        ...rows[0],
        player: { displayName: `Player ${index}` },
        classification: { type },
      }));

    expect(rankPlayers(typedRows, 'type').map((row) => row.classification.type)).toEqual([
      'Maniac', 'Action Player', 'Gambler', 'Neutral', 'One-Bullet', 'Steady', 'NIT', 'Insufficient history',
    ]);
  });
});
