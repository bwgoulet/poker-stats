import { describe, expect, it } from 'vitest';
import { rankPlayers } from '@/lib/stats/player-ranking';

const rows = [
  { player: { displayName: 'Alice' }, totalProfit: 100, avgProfit: 50, roi: 0.5, volatility: 0.2, nightsPlayed: 2, wins: 1, winRate: 0.5 },
  { player: { displayName: 'Zoe' }, totalProfit: 50, avgProfit: 12.5, roi: 1, volatility: 0.7, nightsPlayed: 4, wins: 3, winRate: 0.75 },
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
});
