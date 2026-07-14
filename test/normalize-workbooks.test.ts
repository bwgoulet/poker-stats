import { describe, expect, it } from 'vitest';
import { normalizeWorkbooks } from '@/lib/data/normalize-workbooks';

describe('workbook normalization', () => {
  it('imports spring 2026 $20 games whose player cells use spreadsheet dropdowns', () => {
    const data = normalizeWorkbooks();
    const apr22Results = data.results.filter((r) => r.nightId === 'spring-2026-20-2026-04-22');
    const mar26Results = data.results.filter((r) => r.nightId === 'spring-2026-20-2026-03-26');
    const apr8Results = data.results.filter((r) => r.nightId === 'spring-2026-20-2026-04-08');

    expect(apr22Results).toHaveLength(13);
    expect(apr22Results.reduce((sum, r) => sum + r.buyIn, 0)).toBe(380);
    expect(apr22Results[0]).toMatchObject({ sourceName: 'Favor', cashOut: 95.3, profit: 75.3 });
    expect(mar26Results).toHaveLength(14);
    expect(apr8Results).toHaveLength(12);
  });
});
