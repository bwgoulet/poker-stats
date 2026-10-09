import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/backend/supabase', () => ({ supabaseConfig: () => null, serverSupabase: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/games', useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('Not found'); },
}));
import { gameListingRows } from '@/lib/backend/game-listing';
import * as repository from '@/lib/backend/repository';
import { portalToPokerData } from '@/lib/backend/repository';
import { getDataSeasonIds, parseFilters } from '@/lib/filters/filter-data';
import DraftGameDetails from '@/components/games/DraftGameDetails';
import GamesListing from '@/app/games/games-listing';
import Game from '@/app/games/[nightId]/page';
import type { ManagedGame, PortalData } from '@/lib/backend/types';

const draft: ManagedGame = {
  id: 'draft', leagueId: 'league', title: 'Friday draft', date: '2027-01-08',
  seasonId: 'spring-2027', nightType: '10', format: 'cash', status: 'draft',
  notes: '', version: 1, sourceRef: null,
  results: [
    { playerId: 'alice', buyInCents: 2000, cashOutCents: null, placement: null },
    { playerId: 'bob', buyInCents: 1000, cashOutCents: 0, placement: null },
  ],
};
function portal(): PortalData {
  return {
    configured: true, user: null, selectedLeagueId: 'league',
    leagues: [{ id: 'league', slug: 'poker', name: 'Poker', currency: 'USD', timezone: 'America/New_York', visibility: 'public', role: null }],
    players: [{ id: 'alice', displayName: 'Alice', aliases: [] }, { id: 'bob', displayName: 'Bob', aliases: [] }],
    games: [draft, { ...draft, id: 'finished', status: 'completed', date: '2026-10-09', seasonId: 'fall-2026',
      results: [{ playerId: 'alice', buyInCents: 1000, cashOutCents: 2000, placement: 1 }, { playerId: 'bob', buyInCents: 1000, cashOutCents: 0, placement: 2 }] }],
  };
}

describe('draft game history', () => {
  afterEach(() => vi.restoreAllMocks());

  it('labels drafts and links them to a readable game page for visitors', async () => {
    const data = portal();
    vi.spyOn(repository, 'getPortalData').mockResolvedValue(data);
    const rows = gameListingRows(data, parseFilters({}, getDataSeasonIds(data.games)));
    const listing = renderToStaticMarkup(createElement(GamesListing, { rows }));
    expect(listing).toContain('Draft</span>');
    expect(listing).toContain('href="/games/draft?"');
    const page = await Game({ params: Promise.resolve({ nightId: 'draft' }), searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain('Friday draft');
    expect(html).toContain('Pending');
    expect(html).not.toContain('Edit game');
  });

  it('lists drafts for a visitor, including draft-only seasons, while keeping analytics completed-only', () => {
    const data = portal();
    const rows = gameListingRows(data, parseFilters({}, getDataSeasonIds(data.games)));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'draft', status: 'draft', players: 2, totalPot: 30, winner: 'Pending' });
    expect(rows[1]).toMatchObject({ id: 'finished', status: 'completed', winner: 'Alice', totalPot: 20 });
    const analytics = portalToPokerData(data);
    expect(analytics.nights.map(night => night.id)).toEqual(['finished']);
    expect(analytics.results.every(result => result.nightId === 'finished')).toBe(true);
  });

  it('applies season and night-type filters to drafts and lists empty drafts', () => {
    const data = portal();
    data.games = [...data.games, { ...draft, id: 'empty', results: [] }];
    const seasons = getDataSeasonIds(data.games);
    expect(gameListingRows(data, parseFilters({ season: 'spring-2027' }, seasons)).map(row => row.id)).toEqual(['draft', 'empty']);
    expect(gameListingRows(data, parseFilters({ nightType: '20' }, seasons))).toEqual([]);
    expect(gameListingRows(data, parseFilters({}, seasons)).find(row => row.id === 'empty')).toMatchObject({ players: 0, totalPot: 0, winner: 'Pending' });
  });

  it('renders unknown draft payouts and placements as pending and preserves zero payouts', () => {
    const html = renderToStaticMarkup(createElement(DraftGameDetails, { game: draft, players: portal().players, editable: false }));
    expect(html).toContain('Draft');
    expect(html).toContain('do not count toward standings or statistics');
    expect(html).toContain('Pending');
    expect(html).toContain('$0.00');
    expect(html).toContain('-$10.00');
    expect(html).not.toContain('-$20.00');
    expect(html).not.toContain('Edit game');
    expect(html).not.toContain('Profit distribution');
  });

  it('renders an empty draft and only offers editing to authorized users', () => {
    const html = renderToStaticMarkup(createElement(DraftGameDetails, { game: { ...draft, results: [] }, players: [], editable: true }));
    expect(html).toContain('No results entered yet.');
    expect(html).toContain('Edit game');
  });
});
