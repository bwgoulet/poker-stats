import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerResult, PokerNight } from '@/types/poker';
import type { SearchParams } from '@/lib/filters/scope-query';

const mocks = vi.hoisted(() => ({ getPokerData: vi.fn(), distribution: vi.fn(), playersTable: vi.fn(), comparison: vi.fn() }));
vi.mock('@/lib/data/poker-repository', () => ({ getPokerData: mocks.getPokerData }));
vi.mock('@/components/charts/ProfitDistribution', () => ({ ProfitDistribution: mocks.distribution }));
vi.mock('@/components/players/PlayersTable', () => ({ PlayersTable: mocks.playersTable }));
vi.mock('@/components/charts/ComparisonProfitChart', () => ({ ComparisonProfitChart: mocks.comparison }));
import Dashboard from '@/app/dashboard/page';
import Stats from '@/app/stats/page';
import Players from '@/app/players/page';
import Compare from '@/app/compare/page';

const nights: PokerNight[] = [
  { id: 'spring-ten', seasonId: 'spring-2026', nightType: '10', date: '2026-02-01', title: 'Spring ten' },
  { id: 'spring-twenty', seasonId: 'spring-2026', nightType: '20', date: '2026-02-02', title: 'Spring twenty' },
  { id: 'fall-ten', seasonId: 'fall-2025', nightType: '10', date: '2025-10-01', title: 'Fall ten' },
  { id: 'online', seasonId: 'spring-2026', nightType: 'online', date: '2026-02-03', title: 'Online game' },
];
const players = ['alice', 'bob'].map(id => ({ id, displayName: id, aliases: [] }));
function result(nightId: string, playerId: string, buyIn: number, cashOut: number): PlayerResult {
  return { nightId, playerId, buyIn, cashOut, profit: cashOut - buyIn, sourceName: playerId };
}
const results = [
  result('spring-ten', 'alice', 10, 15), result('spring-ten', 'bob', 10, 5),
  result('spring-twenty', 'alice', 20, 25), result('spring-twenty', 'bob', 20, 10),
  result('fall-ten', 'alice', 10, 110), result('online', 'alice', 50, 500),
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.distribution.mockReturnValue(createElement('div', null, 'Distribution'));
  mocks.playersTable.mockReturnValue(createElement('div', null, 'Players table'));
  mocks.comparison.mockReturnValue(createElement('div', null, 'Comparison chart'));
  mocks.getPokerData.mockResolvedValue({ players, nights, results,
    league: { id: 'league', name: 'League', role: null },
    issues: nights.map(night => ({ sheet: night.id, message: 'Cash mismatch' })),
  });
});
async function render(page: typeof Dashboard, params: SearchParams) {
  return renderToStaticMarkup(await page({ searchParams: Promise.resolve(params) }));
}

describe('scope-dependent analytics', () => {
  const scope = { season: 'spring-2026', nightType: ['10', '20'], minNights: '1' };

  it('uses the selected games for dashboard totals, reconciliation, recent nights and distribution', async () => {
    const html = await render(Dashboard, scope);
    expect(html).toContain('Selected scope');
    expect(html).toContain('$5.00');
    expect(html).toContain('$60.00');
    expect(html).toContain('$30.00');
    expect(html).not.toContain('Fall ten');
    expect(html).not.toContain('Online game');
    expect(html).not.toContain('Season snapshot');
    expect(mocks.distribution.mock.calls[0][0].rows).toEqual([
      expect.objectContaining({ id: 'alice', profit: 10 }),
      expect.objectContaining({ id: 'bob', profit: -15 }),
    ]);
    expect(html).toContain('season=spring-2026&amp;nightType=10&amp;nightType=20');
  });

  it('recomputes the dashboard when the selected night types change', async () => {
    const html = await render(Dashboard, { ...scope, nightType: 'online' });
    expect(html).toContain('Online game');
    expect(html).not.toContain('Spring ten');
    expect(mocks.distribution.mock.calls[0][0].rows).toEqual([expect.objectContaining({ id: 'alice', profit: 450 })]);
  });

  it('scopes player totals and the count of data-quality notes', async () => {
    await render(Players, scope);
    expect(mocks.playersTable.mock.calls[0][0].rows).toEqual([
      expect.objectContaining({ player: players[0], totalProfit: 10, nightsPlayed: 2 }),
      expect.objectContaining({ player: players[1], totalProfit: -15, nightsPlayed: 2 }),
    ]);
    expect(await render(Stats, scope)).toContain('2 validation or reconciliation notes in the selected scope.');
    expect(await render(Stats, { ...scope, nightType: 'online' })).toContain('1 validation or reconciliation notes in the selected scope.');
  });

  it('applies the minimum nights to player lists, comparisons and dashboard distributions', async () => {
    const params = { ...scope, minNights: '3' };
    await render(Players, params);
    expect(mocks.playersTable.mock.calls[0][0].rows).toEqual([]);
    await render(Dashboard, params);
    expect(mocks.distribution.mock.calls[0][0].rows).toEqual([]);
    const html = await render(Compare, { ...params, player: ['alice', 'bob'] });
    expect(html).toContain('2 selected players do not meet the 3-night minimum');
    expect(mocks.comparison).not.toHaveBeenCalled();
  });

  it('does not show out-of-scope statistics when no games match', async () => {
    const html = await render(Dashboard, { ...scope, nightType: '50' });
    expect(html).toContain('No poker nights match this filter');
    expect(html).not.toContain('Reconciliation discrepancies');
    expect(mocks.distribution).not.toHaveBeenCalled();
  });
});
