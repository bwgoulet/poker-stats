import { describe, expect, it } from 'vitest';
import { classifyNightType, nightTypeLabel } from '@/lib/filters/night-types';
import { filterNights, filterResults, parseFilters, scopeLabel } from '@/lib/filters/filter-data';
import { gameInputSchema } from '@/lib/backend/validation';
import { playerStats } from '@/lib/stats/statistics';
import type { PokerNight, PlayerResult } from '@/types/poker';

const season = 'fall-2026';
const nights: PokerNight[] = [
  { id: 'regular10', title: '$10 night', date: '2026-09-01', seasonId: season, nightType: '10' },
  { id: 'regular20', title: '$20 night', date: '2026-09-02', seasonId: season, nightType: '20' },
  { id: 'misclassified10', title: 'Friday one-off', date: '2026-09-03', seasonId: season, nightType: '10' },
  { id: 'misclassified20', title: '$20 One-Off game', date: '2026-09-04', seasonId: season, nightType: '20' },
  { id: 'typed10', title: '$10 one-off', date: '2026-09-05', seasonId: season, nightType: 'one-off-10' },
  { id: 'typed20', title: '$20 one-off', date: '2026-09-06', seasonId: season, nightType: 'one-off-20' },
  { id: 'unknown', title: 'One-off', date: '2026-09-07', seasonId: season, nightType: 'one-off' },
];

describe('one-off scope categories', () => {
  it('excludes games explicitly titled one-off from regular season stats', () => {
    expect(filterNights(nights, parseFilters({}, [season])).map(n => n.id)).toEqual(['regular10', 'regular20']);
  });

  it.each([
    ['one-off-10', ['misclassified10', 'typed10']],
    ['one-off-20', ['misclassified20', 'typed20']],
    ['one-off-other', ['unknown']],
  ])('isolates %s without including regular nights', (nightType, ids) => {
    expect(filterNights(nights, parseFilters({ nightType }, [season])).map(n => n.id)).toEqual(ids);
  });

  it('keeps legacy One-offs links and saved scope selecting all one-offs', () => {
    const filters = parseFilters({ nightType: 'one-off' }, [season]);
    expect(filters.nightType).toEqual(['one-off-10', 'one-off-20', 'one-off-other']);
    expect(filterNights(nights, filters).map(n => n.id)).toEqual(nights.slice(2).map(n => n.id));
  });

  it('supports regular and one-off stakes together and filters their results by game ID', () => {
    const filters = parseFilters({ nightType: ['20', 'one-off-10'] }, [season]);
    const results: PlayerResult[] = nights.map(night => ({ nightId: night.id, playerId: 'alice', buyIn: 100,
      cashOut: 200, profit: 100, sourceName: 'Alice' }));
    expect(filterResults(results, nights, filters).map(r => r.nightId)).toEqual(['regular20', 'misclassified10', 'typed10']);
    expect(scopeLabel(filters, [season])).toBe('All-time · $20 nights + $10 one-offs · 1+ nights');
    expect(nightTypeLabel('one-off-20')).toBe('$20 one-offs');
  });

  it.each(['One-off game', 'ONE OFF game', 'Oneoff game', 'One‑off game'])('recognizes explicit title %s without deriving stakes from player buy-ins', title => {
    expect(classifyNightType('10', title)).toBe('one-off-10');
    expect(classifyNightType('20', title)).toBe('one-off-20');
    expect(classifyNightType('one-off', title)).toBe('one-off');
  });

  it('retains explicitly chosen categories and does not misread ordinary titles', () => {
    expect(classifyNightType('20', 'Friday game')).toBe('20');
    expect(classifyNightType('one-off-10', 'Friday game')).toBe('one-off-10');
    expect(classifyNightType('one-off', '$10 one-off')).toBe('one-off-10');
    expect(classifyNightType('one-off', '$20 one-off')).toBe('one-off-20');
    expect(classifyNightType('10', '$20 one-off')).toBe('one-off-20');
    expect(classifyNightType('one-off', '$100 one-off')).toBe('one-off');
    expect(classifyNightType('one-off', '$10 / $20 one-off')).toBe('one-off');
  });

  it('normalizes a regular stake with a one-off title at the API validation boundary', () => {
    const input = { title: 'Friday One-off', date: '2026-10-09', seasonId: season, nightType: '20',
      format: 'cash', status: 'draft', notes: '', results: [] };
    expect(gameInputSchema.parse(input).nightType).toBe('one-off-20');
    expect(gameInputSchema.parse({ ...input, nightType: 'one-off-10' }).nightType).toBe('one-off-10');
    expect(gameInputSchema.safeParse({ ...input, nightType: 'one-off-100' }).success).toBe(false);
  });

  it('calculates profit and big blinds for explicitly staked one-offs in their own scope', () => {
    const filters = parseFilters({ nightType: ['one-off-10', 'one-off-20'] }, [season]);
    const scoped = filterNights(nights, filters);
    const results: PlayerResult[] = [
      { nightId: 'typed10', playerId: 'alice', buyIn: 50, cashOut: 60, profit: 10, sourceName: 'Alice' },
      { nightId: 'typed20', playerId: 'alice', buyIn: 60, cashOut: 50, profit: -10, sourceName: 'Alice' },
    ];
    const [stat] = playerStats([{ id: 'alice', displayName: 'Alice', aliases: [] }], scoped, results);
    expect(stat).toMatchObject({ totalProfit: 0, nightsPlayed: 2, bbNights: 2, totalBB: 50, avgBB: 25 });
  });
});
