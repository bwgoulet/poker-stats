import { describe, expect, it } from 'vitest';

import { parseFilters } from '@/lib/filters/filter-data';

describe('global filters', () => {
  it('excludes $50 nights and one-offs by default', () => {
    expect(parseFilters({}).nightType).toEqual(['10', '20']);
    expect(parseFilters({}).minNights).toBe(1);
  });

  it('respects explicitly selected night types', () => {
    expect(parseFilters({ nightType: ['10', '20', '50', 'online', 'one-off'] }).nightType).toEqual([
      '10',
      '20',
      '50',
      'online',
      'one-off-10',
      'one-off-20',
      'one-off-other',
    ]);
  });

  it('accepts supported minimum-night values and falls back for invalid values', () => {
    expect(parseFilters({ minNights: '10' }).minNights).toBe(10);
    expect(parseFilters({ minNights: '2' }).minNights).toBe(1);
  });
});
