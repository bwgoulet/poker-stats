import { describe, expect, it } from 'vitest';
import type { ManagedGame, ManagedPlayer } from '@/lib/backend/types';
import { gameCashTotals, moneyToCents, needsReconciliation, toGameInput, validateFields, type GameFields } from './game-input';

const players: ManagedPlayer[] = [{ id: 'a', displayName: 'Alex', aliases: [] }, { id: 'b', displayName: 'Blair', aliases: [] }];
const fields = (): GameFields => ({ title: 'Friday game', date: '2026-10-09', seasonId: 'fall-2026', nightType: '10', format: 'cash', notes: '', results: [
  { key: '1', playerId: 'a', buyIn: '10.10', cashOut: '20.20', placement: '' },
  { key: '2', playerId: 'b', buyIn: '10.10', cashOut: '0', placement: '' },
] });

describe('game editor financial validation', () => {
  it('keeps cents exact and rejects rounding, negative values, and scientific notation', () => {
    expect(moneyToCents('10.10')).toBe(1010);
    expect(moneyToCents(' 0.01 ')).toBe(1);
    for (const amount of ['', '-1', '1.234', '1e2', 'NaN', 'Infinity', '1000000.01']) expect(moneyToCents(amount)).toBeNull();
  });
  it('allows a pending payout in drafts but excludes it from completion', () => {
    const game = fields(); game.results[0].cashOut = '';
    const result = validateFields(game, players);
    expect(result.draftErrors).toEqual([]);
    expect(result.completionErrors.length).toBeGreaterThan(0);
    expect(toGameInput(game, 'draft', null).results[0].cashOutCents).toBeNull();
  });
  it('allows differing totals and requires unique league players', () => {
    const game = fields();
    expect(validateFields(game, players).completionErrors).toEqual([]);
    game.results[0].cashOut = '20.19';
    expect(validateFields(game, players).completionErrors).toEqual([]);
    game.results[1].playerId = 'a';
    expect(validateFields(game, players).draftErrors).toContain('Player row 2: this player is already entered.');
    game.results[1].playerId = 'another-league-player';
    expect(validateFields(game, players).draftErrors).toContain('Player row 2: choose a player.');
  });
  it.each(['19.20', '21.20', '0'])('allows completion with a cash-out total of %s', cashOut => {
    const game = fields(); game.results[0].cashOut = cashOut;
    const result = validateFields(game, players);
    expect(result.draftErrors).toEqual([]);
    expect(result.completionErrors).toEqual([]);
    expect(result.buyInCents).toBe(2020);
    expect(result.cashOutCents).toBe(moneyToCents(cashOut));
  });
  it('rejects impossible dates and respects server field constraints', () => {
    const game = fields(); game.date = '2026-02-30'; game.seasonId = 'Fall 2026'; game.title = 'x'.repeat(121); game.notes = 'x'.repeat(2001);
    expect(validateFields(game, players).draftErrors).toHaveLength(4);
  });
  it('accepts temporary tournament gaps in drafts and requires 1 through N on completion', () => {
    const game = fields(); game.format = 'tournament'; game.results[0].placement = '1'; game.results[1].placement = '3';
    expect(validateFields(game, players).draftErrors).toEqual([]);
    expect(validateFields(game, players).completionErrors).toContain('Player row 2: completed placements must run from 1 through 2.');
    game.results[1].placement = '2';
    expect(validateFields(game, players).completionErrors).toEqual([]);
  });
  it('carries the saved version and clears imported profit overrides on save', () => {
    const existing: ManagedGame = { ...toGameInput(fields(), 'completed', null), id: 'game', leagueId: 'league', version: 7, sourceRef: 'workbook:game', results: [
      { playerId: 'a', buyInCents: 1010, cashOutCents: 2020, placement: null, legacyProfitCents: 1000 },
      { playerId: 'b', buyInCents: 1010, cashOutCents: 0, placement: null, legacyProfitCents: -1010 },
    ] };
    expect(needsReconciliation(existing)).toBe(false);
    const input = toGameInput(fields(), 'completed', existing);
    expect(input.expectedVersion).toBe(7);
    expect(input.results[0]).not.toHaveProperty('legacyProfitCents');
  });
});


it('reports exact cash differences and keeps pending payouts distinct from zero', () => {
  const game: ManagedGame = { ...toGameInput(fields(), 'completed', null), id: 'game', leagueId: 'league', version: 1, sourceRef: null,
    results: [{ playerId: 'a', buyInCents: 5000, cashOutCents: 3610, placement: null, legacyProfitCents: null }] };
  expect(gameCashTotals(game)).toEqual({ totalIn: 5000, totalOut: 3610, pendingPayouts: 0, difference: -1390 });
  expect(needsReconciliation(game)).toBe(true);
  game.results[0].cashOutCents = 6390;
  expect(gameCashTotals(game).difference).toBe(1390);
  game.results[0].cashOutCents = null;
  expect(gameCashTotals(game).difference).toBeNull();
  expect(needsReconciliation(game)).toBe(true);
  game.status = 'draft';
  expect(needsReconciliation(game)).toBe(false);
});
