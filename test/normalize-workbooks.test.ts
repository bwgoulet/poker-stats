import { describe, expect, it } from 'vitest';
import { blockIsOnline, normalizeWorkbooks } from '@/lib/data/normalize-workbooks';
import { discoverWorkbooks } from '@/lib/data/load-workbooks';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('workbook normalization', () => {
  it('automatically discovers current and future season workbooks', () => {
    const directory = mkdtempSync(join(tmpdir(), 'poker-workbooks-'));
    writeFileSync(join(directory, 'summer-2026.xlsx'), '');
    writeFileSync(join(directory, 'fall-2026.xlsx'), '');
    writeFileSync(join(directory, 'notes.txt'), '');

    expect(discoverWorkbooks(directory).map((workbook) => workbook.seasonId)).toEqual([
      'fall-2026',
      'summer-2026',
    ]);
  });

  it('imports summer 2026 games without a hard-coded season registration', () => {
    const data = normalizeWorkbooks();
    expect(data.nights.some((night) => night.seasonId === 'summer-2026')).toBe(true);
    expect(data.results.some((result) => result.nightId.startsWith('summer-2026-'))).toBe(true);
  });

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

  it('recognizes truthy Online column values within a game block', () => {
    const rows = [
      ['', 'Sep 2nd 2026', '', '', '', true],
      ['Player', '', 'Buy-in', 'End', 'Net', 'Online'],
      ['Ben', '', 20, 40, 20, true],
      ['', 'Sep 9th 2026', '', '', '', false],
      ['Player', '', 'Buy-in', 'End', 'Net', 'Online'],
      ['Calen', '', 20, 0, -20, false],
    ];

    expect(blockIsOnline(rows, 0, 5, 'fall-2026')).toBe(true);
    expect(blockIsOnline(rows, 3, 5, 'fall-2026')).toBe(false);
  });
});
