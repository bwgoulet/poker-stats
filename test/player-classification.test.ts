import { describe, expect, it } from 'vitest';

import { classifyPlayers, PLAYER_TYPE_DESCRIPTIONS } from '@/lib/stats/player-classification';
import { PlayerResult, PokerNight } from '@/types/poker';

const nights: PokerNight[] = Array.from({ length: 16 }, (_, index) => ({
  id: `n${index}`,
  date: `2026-01-${String(index + 1).padStart(2, '0')}`,
  title: '$20 night',
  seasonId: 'test-2026',
  nightType: '20',
}));

function row(id: string, buyIns: number[], profits: number[]) {
  const results: PlayerResult[] = buyIns.map((buyInUnits, index) => ({
    nightId: nights[index].id,
    playerId: id,
    buyIn: buyInUnits * 20,
    cashOut: (buyInUnits + profits[index]) * 20,
    profit: profits[index] * 20,
    sourceName: id,
  }));
  return { player: { id }, results };
}

describe('player classification', () => {
  it('provides an explanation for every displayed player type', () => {
    expect(Object.keys(PLAYER_TYPE_DESCRIPTIONS)).toEqual(expect.arrayContaining([
      'NIT', 'Steady', 'Neutral', 'Gambler', 'Action Player', 'Maniac', 'Insufficient history',
    ]));
    expect(Object.values(PLAYER_TYPE_DESCRIPTIONS).every((description) => description.length > 20)).toBe(true);
  });

  it('requires five comparable nights', () => {
    const classifications = classifyPlayers([row('new', [1, 1, 1, 1], [-1, 0, 1, 0])], nights);
    expect(classifications.get('new')).toMatchObject({
      type: 'Insufficient history',
      confidence: 'insufficient',
      qualifyingNights: 4,
    });

    const eligible = classifyPlayers([row('eligible', [1, 1, 1, 1, 1], [-1, 0, 1, 0, 0])], nights);
    expect(eligible.get('eligible')).toMatchObject({
      type: 'Neutral',
      confidence: 'provisional',
      qualifyingNights: 5,
    });
  });

  it('does not force extreme labels in a homogeneous field', () => {
    const flat = Array(8).fill(1);
    const profits = [-0.5, 0.5, -0.5, 0.5, -0.5, 0.5, -0.5, 0.5];
    const classifications = classifyPlayers([
      row('a', flat, profits), row('b', flat, profits), row('c', flat, profits), row('d', flat, profits),
    ], nights);
    expect([...classifications.values()].map((result) => result.type)).toEqual([
      'Neutral', 'Neutral', 'Neutral', 'Neutral',
    ]);
  });

  it('identifies a high-exposure, high-swing player as a Maniac', () => {
    const classifications = classifyPlayers([
      row('nit', Array(8).fill(1), [-0.1, 0.1, -0.1, 0.1, -0.1, 0.1, -0.1, 0.1]),
      row('steady', Array(8).fill(1.2), [-0.4, 0.4, -0.4, 0.4, -0.4, 0.4, -0.4, 0.4]),
      row('neutral', Array(8).fill(1.4), [-0.8, 0.8, -0.8, 0.8, -0.8, 0.8, -0.8, 0.8]),
      row('maniac', Array(8).fill(3), [-4, 4, -4, 4, -4, 4, -4, 4]),
    ], nights);
    expect(classifications.get('maniac')).toMatchObject({ type: 'Maniac', confidence: 'provisional' });
    expect(classifications.get('maniac')?.exposurePercentile).toBe(100);
    expect(classifications.get('maniac')?.swingPercentile).toBe(100);
  });

  it('excludes one-off nights without a nominal buy-in', () => {
    const oneOffs = nights.slice(0, 8).map((night) => ({ ...night, nightType: 'one-off' as const }));
    const classifications = classifyPlayers([row('guest', Array(8).fill(3), Array(8).fill(2))], oneOffs);
    expect(classifications.get('guest')).toMatchObject({
      type: 'Insufficient history',
      qualifyingNights: 0,
    });
  });

  it('marks classifications established after fifteen qualifying nights', () => {
    const classifications = classifyPlayers([
      row('regular', Array(15).fill(1), Array.from({ length: 15 }, (_, index) => index % 2 ? 0.5 : -0.5)),
    ], nights);
    expect(classifications.get('regular')?.confidence).toBe('established');
  });
});
