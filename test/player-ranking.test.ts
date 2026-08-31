import { describe, expect, it } from 'vitest';
import { rankPlayers } from '@/lib/stats/player-ranking';

const rows = [
  { player: { displayName: 'Alice' }, totalProfit: 100, avgProfit: 50, roi: 0.5, nightsPlayed: 2, wins: 1, winRate: 0.5 },
  { player: { displayName: 'Zoe' }, totalProfit: 50, avgProfit: 12.5, roi: 1, nightsPlayed: 4, wins: 3, winRate: 0.75 },
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

  it('ranks all player types from Maniac to insufficient history', () => {
    const typedRows = ['NIT', 'Neutral', 'One-Bullet', 'Insufficient history', 'Gambler', 'Chemical X', 'Steady', 'Whale', 'Maniac', 'Action Player']
      .map((type, index) => ({
        ...rows[0],
        player: { displayName: `Player ${index}` },
        classification: { type },
      }));

    expect(rankPlayers(typedRows, 'type').map((row) => row.classification.type)).toEqual([
      'Maniac', 'Action Player', 'Whale', 'Chemical X', 'Gambler', 'Neutral', 'Steady', 'One-Bullet', 'NIT', 'Insufficient history',
    ]);
  });

  it('ranks raw classification measurements with unavailable values last', () => {
    const classifiedRows = [
      { ...rows[0], player: { displayName: 'Middle' }, classification: { type: 'Neutral', averageBuyInUnits: 1.5, outcomeSwing: 1.25 } },
      { ...rows[0], player: { displayName: 'Unavailable' }, classification: { type: 'Insufficient history', averageBuyInUnits: null, outcomeSwing: null } },
      { ...rows[0], player: { displayName: 'High' }, classification: { type: 'Maniac', averageBuyInUnits: 2.5, outcomeSwing: 3.25 } },
    ];

    expect(rankPlayers(classifiedRows, 'buyInIntensity').map((row) => row.player.displayName)).toEqual(['High', 'Middle', 'Unavailable']);
    expect(rankPlayers(classifiedRows, 'outcomeSwing').map((row) => row.player.displayName)).toEqual(['High', 'Middle', 'Unavailable']);
  });
});
