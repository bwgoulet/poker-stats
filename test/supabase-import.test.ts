import { describe, expect, it } from 'vitest';
import { buildWorkbookImport, type NormalizedWorkbookData } from '@/lib/backend/import-workbooks';
import { normalizeWorkbooks } from '@/lib/data/normalize-workbooks';
import { UNC_LEAGUE_ID } from '@/lib/backend/types';

function fixture(): NormalizedWorkbookData {
  return {
    players: [{ id: 'alex', displayName: "Alex O'Brien", aliases: ['Alex', "Alex O'Brien"] }],
    nights: [{ id: 'fall-2026-20-2026-09-01', date: '2026-09-01', title: '$20 night', seasonId: 'fall-2026', nightType: '20', notes: 'Original source note' }],
    results: [{ nightId: 'fall-2026-20-2026-09-01', playerId: 'alex', buyIn: 20, cashOut: 31.5, profit: 10, placement: 1, sourceName: 'Alex' }],
    issues: [{ workbook: 'fall-2026.xlsx', sheet: 'Stats $20', row: 5, severity: 'warning', message: 'Skipped someone: malformed buy-in/cash-out' }],
  };
}

describe('offline Supabase workbook import', () => {
  it('preserves canonical historical IDs and source standings in integer cents', () => {
    const normalized = normalizeWorkbooks();
    const imported = buildWorkbookImport(normalized);
    expect(imported.manifest.league.id).toBe(UNC_LEAGUE_ID);
    expect(imported.players.map((player) => player.id).sort()).toEqual(normalized.players.map((player) => player.id).sort());
    expect(imported.games.map((game) => game.id).sort()).toEqual(normalized.nights.map((night) => night.id).sort());
    expect(imported.manifest.counts.results).toBe(normalized.results.length);
    const actual = new Map(imported.games.flatMap((game) => game.results.map((result) => [`${game.id}/${result.playerId}`, result] as const)));
    for (const result of normalized.results) {
      const migrated = actual.get(`${result.nightId}/${result.playerId}`)!;
      expect(migrated.buyInCents).toBe(Math.round(result.buyIn * 100));
      expect(migrated.cashOutCents).toBe(Math.round(result.cashOut * 100));
      expect(migrated.legacyProfitCents ?? migrated.cashOutCents - migrated.buyInCents).toBe(Math.round(result.profit * 100));
      expect(migrated.placement).toBe(result.placement ?? null);
    }
    expect(imported.manifest.normalizerIssues).toEqual(normalized.issues);
    expect(imported.games.every((game) => game.format === 'cash' && game.status === 'completed')).toBe(true);
  });

  it('reports source Net discrepancies, malformed rows, inferred placements and assumed format', () => {
    const imported = buildWorkbookImport(fixture(), {
      sources: [{ file: 'fall-2026.xlsx', seasonId: 'fall-2026', sha256: 'test-source-hash' }],
      generatedAt: '2026-10-01T00:00:00.000Z',
    });
    expect(imported.games[0].results[0]).toMatchObject({ buyInCents: 2000, cashOutCents: 3150, legacyProfitCents: 1000, placement: 1 });
    expect(imported.games[0].sourceRef).toBe('workbook:v1:fall-2026.xlsx#fall-2026-20-2026-09-01');
    expect(imported.games[0].notes).toContain('Original source note');
    expect(imported.games[0].notes).toContain('Cash format assumed; placements inferred');
    expect(imported.games[0].notes).toContain('does not reconcile');
    expect(imported.manifest.counts).toMatchObject({ legacyProfitOverrides: 1, normalizerIssues: 1 });
    expect(imported.manifest.games[0]).toMatchObject({ sourceProfitTotalCents: 1000, cashFlowTotalCents: 1150 });
    expect(imported.manifest.normalizerIssues[0].row).toBe(5);
    expect(imported.manifest.sources[0].sha256).toBe('test-source-hash');
  });

  it('stores no legacy profit override when source Net agrees with recorded cash flow', () => {
    const data = fixture();
    data.results[0].profit = 11.5;
    expect(buildWorkbookImport(data).games[0].results[0].legacyProfitCents).toBeNull();
  });

  it('refuses duplicate canonical game, player, or result records', () => {
    const duplicatedGame = fixture();
    duplicatedGame.nights.push({ ...duplicatedGame.nights[0] });
    expect(() => buildWorkbookImport(duplicatedGame)).toThrow('Games: duplicate canonical ID');
    const duplicatedPlayer = fixture();
    duplicatedPlayer.players.push({ ...duplicatedPlayer.players[0] });
    expect(() => buildWorkbookImport(duplicatedPlayer)).toThrow('Players: duplicate canonical ID');
    const duplicatedResult = fixture();
    duplicatedResult.results.push({ ...duplicatedResult.results[0] });
    expect(() => buildWorkbookImport(duplicatedResult)).toThrow('Duplicate result');
    const conflictingName = fixture();
    conflictingName.players.push({ id: 'another-id', displayName: "alex o'brien", aliases: [] });
    expect(() => buildWorkbookImport(conflictingName)).toThrow('Conflicting canonical player display name');
  });

  it('refuses dangling references, invalid amounts and source values with sub-cent precision', () => {
    const missingGame = fixture();
    missingGame.results[0].nightId = 'missing';
    expect(() => buildWorkbookImport(missingGame)).toThrow('missing game');
    const missingPlayer = fixture();
    missingPlayer.results[0].playerId = 'missing';
    expect(() => buildWorkbookImport(missingPlayer)).toThrow('missing player');
    const negative = fixture();
    negative.results[0].buyIn = -1;
    expect(() => buildWorkbookImport(negative)).toThrow('Negative buy-in/cash-out');
    const subCent = fixture();
    subCent.results[0].profit = 1.005;
    expect(() => buildWorkbookImport(subCent)).toThrow('sub-cent precision');
    const invalid = fixture();
    invalid.results[0].cashOut = Number.NaN;
    expect(() => buildWorkbookImport(invalid)).toThrow('supported cent range');
    const oversized = fixture();
    oversized.results[0].buyIn = 21474836.48;
    expect(() => buildWorkbookImport(oversized)).toThrow('supported cent range');
    const overSchemaLimit = fixture();
    overSchemaLimit.results[0].buyIn = 1000000.01;
    expect(() => buildWorkbookImport(overSchemaLimit)).toThrow('database amount limit');
  });

  it('creates deterministic SQL with escaped text, conflict checks and game-scoped result insertion', () => {
    const imported = buildWorkbookImport(fixture());
    expect(imported.sql).toBe(buildWorkbookImport(fixture()).sql);
    expect(imported.sql).toContain("'Alex O''Brien'");
    expect(imported.sql).toContain('begin;');
    expect(imported.sql).toContain('commit;');
    expect(imported.sql).toContain('lock table public.leagues, public.players, public.games, public.game_results');
    expect(imported.sql).toContain('g.source_ref is distinct from s.source_ref');
    expect(imported.sql).toContain('except');
    expect(imported.sql).toContain('with inserted_games as (');
    expect(imported.sql).toContain('from _poker_import_results r join inserted_games g on g.id = r.game_id;');
    expect(imported.sql).not.toMatch(/\b(update|delete)\s+public\./i);
  });

  it('preserves empty source games with a review warning rather than inventing results', () => {
    const data = fixture();
    data.results = [];
    const imported = buildWorkbookImport(data);
    expect(imported.games).toHaveLength(1);
    expect(imported.games[0].results).toHaveLength(0);
    expect(imported.manifest.games[0].warnings).toContain('No valid result rows; the source game is preserved for review.');
  });

  it('rejects missing source files and duplicate season provenance', () => {
    expect(() => buildWorkbookImport(fixture(), { sources: [{ file: 'other.xlsx', seasonId: 'spring-2026', sha256: 'hash' }] })).toThrow('Missing workbook source');
    expect(() => buildWorkbookImport(fixture(), { sources: [
      { file: 'fall-2026.xlsx', seasonId: 'fall-2026', sha256: 'hash' },
      { file: 'another.xlsx', seasonId: 'fall-2026', sha256: 'hash2' },
    ] })).toThrow('Duplicate source season');
  });
});
