import { describe, expect, it } from 'vitest';

import {
  classifyPlayers,
  LOW_EXPOSURE_PERCENTILE_MAX,
  LOW_MEDIAN_BUY_IN_UNITS_MAX,
  LOW_MULTI_BUY_IN_RATE_MAX,
  LOW_OUTCOME_SWING_MAX,
  LOW_SWING_PERCENTILE_MAX,
  PLAYER_TYPE_DESCRIPTIONS,
} from '@/lib/stats/player-classification';
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

  it('exports the inclusive low classification boundaries', () => {
    expect({
      exposurePercentile: LOW_EXPOSURE_PERCENTILE_MAX,
      medianBuyInUnits: LOW_MEDIAN_BUY_IN_UNITS_MAX,
      multiBuyInRate: LOW_MULTI_BUY_IN_RATE_MAX,
      swingPercentile: LOW_SWING_PERCENTILE_MAX,
      outcomeSwing: LOW_OUTCOME_SWING_MAX,
    }).toEqual({
      exposurePercentile: 33,
      medianBuyInUnits: 1.5,
      multiBuyInRate: 0.25,
      swingPercentile: 33,
      outcomeSwing: 1,
    });
  });

  it('accepts a 25% multi-buy-in rate and a one-buy-in outcome swing', () => {
    const unitMad = 1 / 1.4826;
    const classifications = classifyPlayers([
      row('boundary', [1, 1, 1, 1, 1, 1, 2, 2], Array.from({ length: 8 }, (_, i) => i % 2 ? unitMad : -unitMad)),
      row('middle', Array(8).fill(2), Array.from({ length: 8 }, (_, i) => i % 2 ? 2 : -2)),
      row('high', Array(8).fill(3), Array.from({ length: 8 }, (_, i) => i % 2 ? 3 : -3)),
    ], nights);

    expect(classifications.get('boundary')).toMatchObject({
      type: 'NIT',
      medianBuyInUnits: 1,
      multiBuyInRate: 0.25,
      outcomeSwing: 1,
    });
  });

  it('keeps a low-swing player with greater than 25% multi-buy-ins Steady', () => {
    const classifications = classifyPlayers([
      row('frequent-rebuys', [1, 1, 1, 1, 1, 2, 2, 2], Array.from({ length: 8 }, (_, i) => i % 2 ? 0.1 : -0.1)),
      row('middle', Array(8).fill(2), Array.from({ length: 8 }, (_, i) => i % 2 ? 1 : -1)),
      row('high', Array(8).fill(3), Array.from({ length: 8 }, (_, i) => i % 2 ? 2 : -2)),
    ], nights);

    expect(classifications.get('frequent-rebuys')).toMatchObject({
      type: 'Steady',
      multiBuyInRate: 0.375,
    });
  });

  it('measures the inclusive 1.5 median boundary independently of the rebuy gate', () => {
    const classifications = classifyPlayers([
      row('median-boundary', [1, 1, 1, 1, 2, 2, 2, 2], Array.from({ length: 8 }, (_, i) => i % 2 ? 0.1 : -0.1)),
      row('middle', Array(8).fill(2.5), Array.from({ length: 8 }, (_, i) => i % 2 ? 1 : -1)),
      row('high', Array(8).fill(3), Array.from({ length: 8 }, (_, i) => i % 2 ? 2 : -2)),
    ], nights);

    expect(classifications.get('median-boundary')).toMatchObject({
      type: 'Steady',
      medianBuyInUnits: 1.5,
      multiBuyInRate: 0.5,
    });
  });

  it('includes players exactly at the 33rd-percentile boundaries', () => {
    const field = Array.from({ length: 101 }, (_, index) => {
      const swing = (index + 1) / 50;
      const deviation = swing / 1.4826;
      return row(
        `player-${index}`,
        Array(8).fill(0.7 + (index * 0.01)),
        Array.from({ length: 8 }, (_, resultIndex) => resultIndex % 2 ? deviation : -deviation),
      );
    });
    const boundary = classifyPlayers(field, nights).get('player-33');

    expect(boundary).toMatchObject({
      type: 'NIT',
      exposurePercentile: 33,
      swingPercentile: 33,
    });
  });
});
