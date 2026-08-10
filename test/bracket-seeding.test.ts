import { describe, expect, it } from 'vitest';
import { roundRobinRounds, seedFirstRound, SeededTeam } from '../src/lib/brackets/seeding';

const teams = (count: number): SeededTeam[] => Array.from({ length: count }, (_, index) => ({ id: `${index + 1}`, name: `Team ${index + 1}`, seed: index + 1 }));

describe('bracket seeding', () => {
  it('pairs the highest and lowest seeds in a power-of-two field', () => {
    const matches = seedFirstRound(teams(8));
    expect(matches.map(match => [match.teamA?.seed, match.teamB?.seed])).toEqual([[1, 8], [2, 7], [3, 6], [4, 5]]);
  });

  it('adds byes without dropping teams', () => {
    const matches = seedFirstRound(teams(6));
    expect(matches).toHaveLength(4);
    expect(matches.flatMap(match => [match.teamA, match.teamB]).filter(Boolean)).toHaveLength(6);
  });

  it('schedules every round-robin pairing exactly once', () => {
    const rounds = roundRobinRounds(teams(5));
    const pairs = rounds.flat().map(match => [match.teamA!.id, match.teamB!.id].sort().join('-'));
    expect(rounds).toHaveLength(5);
    expect(new Set(pairs).size).toBe(10);
  });
});
