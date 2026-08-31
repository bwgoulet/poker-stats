import { describe, expect, it } from 'vitest';

import { parseFilters } from '@/lib/filters/filter-data';

describe('global filters', () => {
  it('excludes $50 nights and one-offs by default', () => {
    expect(parseFilters({}).nightType).toEqual(['10', '20']);
  });

  it('respects explicitly selected night types', () => {
    expect(parseFilters({ nightType: ['10', '20', '50', 'one-off'] }).nightType).toEqual([
      '10',
      '20',
      '50',
      'one-off',
    ]);
  });
});
