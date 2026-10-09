import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCurrentSeasonId,
  getDataSeasonIds,
  parseFilters,
  scopeLabel,
} from '@/lib/filters/filter-data';
import { getSeasonIds } from '@/lib/data/load-workbooks';
import type { PokerNight } from '@/types/poker';

vi.mock('@/lib/data/load-workbooks', () => ({
  getSeasonIds: vi.fn(() => ['workbook-2025']),
}));

const databaseSeasonIds = ['autumn-2030', 'winter-2031'];

function night(id: string, seasonId: string, date: string): PokerNight {
  return { id, seasonId, date, title: id, nightType: '20' };
}

beforeEach(() => vi.clearAllMocks());

describe('filters for database seasons', () => {
  it('defaults to the supplied league seasons without discovering workbooks', () => {
    expect(parseFilters({}, databaseSeasonIds).season).toEqual(databaseSeasonIds);
    expect(getSeasonIds).not.toHaveBeenCalled();
  });

  it('accepts explicit database seasons and rejects seasons outside the league', () => {
    const filters = parseFilters({
      season: ['winter-2031,workbook-2025', 'winter-2031'],
      nightType: '20',
    }, databaseSeasonIds);

    expect(filters.season).toEqual(['winter-2031']);
    expect(scopeLabel(filters, databaseSeasonIds)).toBe('Winter ’31 · $20 nights · 1+ nights');
    expect(getSeasonIds).not.toHaveBeenCalled();
  });

  it('falls back to all supplied league seasons when a selection is invalid', () => {
    expect(parseFilters({ season: 'workbook-2025' }, databaseSeasonIds).season).toEqual(databaseSeasonIds);
  });

  it('labels all selected database seasons as all-time regardless of selection order', () => {
    const filters = parseFilters({
      season: ['winter-2031', 'autumn-2030'],
      nightType: '10,20,50,online,one-off',
      minNights: '3',
    }, databaseSeasonIds);

    expect(scopeLabel(filters, databaseSeasonIds)).toBe('All-time · All night types · 3+ nights');
    expect(getSeasonIds).not.toHaveBeenCalled();
  });

  it('keeps an empty league empty instead of falling back to workbook seasons', () => {
    expect(parseFilters({}, []).season).toEqual([]);
    expect(parseFilters({ season: 'workbook-2025' }, []).season).toEqual([]);
    expect(getSeasonIds).not.toHaveBeenCalled();
  });
});

describe('seasons derived from league game data', () => {
  it('orders unique seasons by their most recent game instead of the season name or input order', () => {
    const nights = [
      night('oldest', 'fall-2025', '2025-09-10'),
      night('early-spring', 'spring-2026', '2026-01-12'),
      night('winter', 'winter-2027', '2027-03-01'),
      night('latest', 'spring-2026', '2028-01-05'),
    ];
    const originalOrder = nights.map(({ id }) => id);

    expect(getDataSeasonIds(nights)).toEqual(['spring-2026', 'winter-2027', 'fall-2025']);
    expect(getCurrentSeasonId(nights)).toBe('spring-2026');
    expect(nights.map(({ id }) => id)).toEqual(originalOrder);
    expect(getSeasonIds).not.toHaveBeenCalled();
  });

  it('orders seasons with equally recent games deterministically', () => {
    const nights = [
      night('winter', 'winter-2027', '2027-03-01'),
      night('autumn', 'autumn-2027', '2027-03-01'),
    ];

    expect(getDataSeasonIds(nights)).toEqual(['autumn-2027', 'winter-2027']);
    expect(getDataSeasonIds([...nights].reverse())).toEqual(['autumn-2027', 'winter-2027']);
  });

  it('has no available or current season when there are no games', () => {
    expect(getDataSeasonIds([])).toEqual([]);
    expect(getCurrentSeasonId([])).toBeUndefined();
    expect(getSeasonIds).not.toHaveBeenCalled();
  });
});
