import { describe, expect, it } from 'vitest';
import { blockIsOnline, normalizeWorkbooks } from '@/lib/data/normalize-workbooks';
import { discoverWorkbooks } from '@/lib/data/load-workbooks';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { historicalData } from './helpers/historical-data';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('archived workbook normalization and historical snapshot', () => {
  const normalizedData = historicalData();

  it('automatically discovers current and future season workbooks', () => {
    const directory = mkdtempSync(join(tmpdir(), 'poker-workbooks-'));
    writeFileSync(join(directory, 'summer-2026.xlsx'), '');
    writeFileSync(join(directory, 'fall-2026.xlsx'), '');
    writeFileSync(join(directory, 'notes.txt'), '');

    try {
      expect(discoverWorkbooks(directory).map((workbook) => workbook.seasonId)).toEqual(['fall-2026', 'summer-2026']);
    } finally { rmSync(directory, { recursive: true }); }
  });

  it('imports summer 2026 games without a hard-coded season registration', () => {
    expect(normalizedData.nights.some((night) => night.seasonId === 'summer-2026')).toBe(true);
    expect(normalizedData.results.some((result) => result.nightId.startsWith('summer-2026-'))).toBe(true);
  });

  it('imports spring 2026 $20 games whose player cells use spreadsheet dropdowns', () => {
    const apr22Results = normalizedData.results.filter((r) => r.nightId === 'spring-2026-20-2026-04-22');
    const mar26Results = normalizedData.results.filter((r) => r.nightId === 'spring-2026-20-2026-03-26');
    const apr8Results = normalizedData.results.filter((r) => r.nightId === 'spring-2026-20-2026-04-08');

    expect(apr22Results).toHaveLength(13);
    expect(apr22Results.reduce((sum, r) => sum + r.buyIn, 0)).toBe(380);
    expect(apr22Results[0]).toMatchObject({ sourceName: 'Favor', cashOut: 95.3, profit: 75.3 });
    expect(mar26Results).toHaveLength(14);
    expect(apr8Results).toHaveLength(12);
  });

  it('normalizes an external archive and reports an incomplete payout without fabricating a result', () => {
    const directory = mkdtempSync(join(tmpdir(), 'poker-archive-'));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Player', '', 'Buy-in', 'End', 'Net'],
      ['', 'October 3rd 2025'],
      ['Ben', '', 20, 30, 10],
      ['Drew', '', 50, '?', '?'],
    ]), 'Stats $20');
    XLSX.writeFile(workbook, join(directory, 'fall-2025.xlsx'));
    try {
      const data = normalizeWorkbooks(directory);
      expect(data.nights).toHaveLength(1);
      expect(data.results).toHaveLength(1);
      expect(data.results[0]).toMatchObject({ buyIn: 20, cashOut: 30, profit: 10 });
      expect(data.issues.some(issue => issue.message === 'Skipped Drew: malformed buy-in/cash-out')).toBe(true);
    } finally { rmSync(directory, { recursive: true }); }
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

  it('imports games and results from a dedicated Online sheet', () => {
    const onlineNight = normalizedData.nights.find(
      (night) => night.id === 'fall-2026-online-2026-09-27',
    );
    const onlineResults = normalizedData.results.filter((result) => result.nightId === onlineNight?.id);

    expect(onlineNight).toMatchObject({
      title: 'Online · 2026-09-27',
      seasonId: 'fall-2026',
      nightType: 'online',
    });
    expect(onlineResults).toHaveLength(9);
    expect(onlineResults.reduce((sum, result) => sum + result.buyIn, 0)).toBe(260);
  });
});
