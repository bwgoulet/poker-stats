import { describe, expect, it } from 'vitest';

import { ordinal, streakLabel } from '@/lib/formatting/format';

describe('ordinal formatting', () => {
  it('uses the correct English suffix for percentiles', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 91, 92].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '91st', '92nd',
    ]);
  });

  it('rounds decimal percentile ranks before choosing a suffix', () => {
    expect(ordinal(91.4)).toBe('91st');
    expect(ordinal(91.5)).toBe('92nd');
  });
});

describe('streak formatting', () => {
  it('pluralizes winning and losing streaks', () => {
    expect([streakLabel(1), streakLabel(5), streakLabel(-1), streakLabel(-3)]).toEqual([
      '1 win', '5 wins', '1 loss', '3 losses',
    ]);
  });

  it('uses a dash when there is no streak', () => {
    expect(streakLabel(0)).toBe('—');
  });
});
