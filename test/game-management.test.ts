import { describe, expect, it } from 'vitest';
import { gameInputSchema } from '@/lib/backend/validation';
import type { GameInput } from '@/lib/backend/types';

const game = (): GameInput => ({
  title: 'Friday poker', date: '2026-10-09', seasonId: 'fall-2026', nightType: '20',
  format: 'cash', status: 'completed', notes: '',
  results: [
    { playerId: 'alice', buyInCents: 2000, cashOutCents: 3500, placement: null },
    { playerId: 'bob', buyInCents: 2000, cashOutCents: 500, placement: null },
  ],
});
describe('game entry validation', () => {
  it('accepts balanced cash games and complete tournament finishes', () => {
    expect(gameInputSchema.parse(game()).results).toHaveLength(2);
    const tournament = game(); tournament.format = 'tournament';
    tournament.results[0].placement = 1; tournament.results[1].placement = 2;
    expect(gameInputSchema.safeParse(tournament).success).toBe(true);
  });
  it.each([0, 3499, 3501, 4500])('accepts mismatched completed cash and tournament totals with payout %i', cashOutCents => {
    const value = game(); value.results[0].cashOutCents = cashOutCents;
    expect(gameInputSchema.parse(value).results[0].cashOutCents).toBe(cashOutCents);
    value.format = 'tournament'; value.results[0].placement = 1; value.results[1].placement = 2;
    expect(gameInputSchema.safeParse(value).success).toBe(true);
  });
  it('preserves a blank cash-out as unknown in drafts', () => {
    const draft = game(); draft.status = 'draft'; draft.results[0].cashOutCents = null;
    expect(gameInputSchema.parse(draft).results[0].cashOutCents).toBeNull();
    draft.status = 'completed';
    expect(gameInputSchema.safeParse(draft).success).toBe(false);
  });
  it.each([
    ['zero total buy-in', (value: GameInput) => { value.results.forEach(row => { row.buyInCents = 0; }); }],
    ['negative buy-in', (value: GameInput) => { value.results[0].buyInCents = -1; }],
    ['fractional cents', (value: GameInput) => { value.results[0].buyInCents = 1.5; }],
    ['duplicate players', (value: GameInput) => { value.results[1].playerId = 'alice'; }],
    ['invalid calendar date', (value: GameInput) => { value.date = '2026-02-30'; }],
    ['invalid season', (value: GameInput) => { value.seasonId = 'Fall 26'; }],
    ['missing tournament finishes', (value: GameInput) => { value.format = 'tournament'; }],
    ['duplicate finishes', (value: GameInput) => { value.format = 'tournament'; value.results.forEach(row => { row.placement = 1; }); }],
    ['gaps in completed finishes', (value: GameInput) => { value.format = 'tournament'; value.results[0].placement = 1; value.results[1].placement = 3; }],
    ['one-player completion', (value: GameInput) => { value.results = [{ playerId: 'alice', buyInCents: 100, cashOutCents: 100, placement: null }]; }],
    ['missing edit version', (value: GameInput) => { value.id = 'existing-game'; }],
  ])('rejects %s', (_, edit) => {
    const value = game(); edit(value);
    expect(gameInputSchema.safeParse(value).success).toBe(false);
  });
  it('does not accept imported profit overrides from a normal save', () => {
    const value = game();
    expect(gameInputSchema.safeParse({ ...value, results: [{ ...value.results[0], legacyProfitCents: 100 }, value.results[1]] }).success).toBe(false);
  });
});
