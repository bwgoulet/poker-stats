import { beforeEach, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  normalize: vi.fn(() => { throw new Error('Historical spreadsheets have been archived.'); }),
  server: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/data/normalize-workbooks', () => ({ normalizeWorkbooks: fixtures.normalize }));
vi.mock('@/lib/backend/supabase', () => ({
  supabaseConfig: () => ({ url: 'https://example.supabase.co', key: 'public-test-key' }),
  serverSupabase: fixtures.server,
}));
import { getActivePokerData } from '@/lib/backend/repository';
import { UNC_LEAGUE_ID } from '@/lib/backend/types';

beforeEach(() => vi.clearAllMocks());

it('reads database analytics when the historical spreadsheets are unavailable', async () => {
  const rows: Record<string, unknown[]> = {
    leagues: [{ id: UNC_LEAGUE_ID, slug: 'unc-poker', name: 'UNC Poker', currency: 'USD', timezone: 'America/New_York', visibility: 'public' }],
    players: [{ id: 'alex', display_name: 'Alex', aliases: [] }],
    games: [{
      id: 'historical', league_id: UNC_LEAGUE_ID, title: 'Historical', date: '2026-09-01',
      season_id: 'fall-2026', night_type: '20', format: 'cash', status: 'completed', notes: '',
      version: 1, source_ref: 'workbook:v1:fall-2026.xlsx#historical',
      results: [{ game_id: 'historical', player_id: 'alex', buy_in_cents: 2000, cash_out_cents: 3000, placement: 1, legacy_profit_cents: 900 }],
    }],
  };
  fixtures.server.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from: (table: string) => {
      const query = {
        select: () => query, order: () => query, eq: () => query,
        range: async () => ({ data: rows[table], error: null }),
      };
      return query;
    },
  });
  const data = await getActivePokerData();
  expect(data.source).toBe('supabase');
  expect(data.players.map(player => player.id)).toEqual(['alex']);
  expect(data.nights.map(game => game.id)).toEqual(['historical']);
  expect(data.results[0]).toMatchObject({ buyIn: 20, cashOut: 30, profit: 9 });
  expect(fixtures.normalize).not.toHaveBeenCalled();
});

it('surfaces a database outage without attempting to load archived spreadsheets', async () => {
  fixtures.server.mockRejectedValue(new Error('Database unavailable'));
  await expect(getActivePokerData()).rejects.toThrow('Database unavailable');
  expect(fixtures.normalize).not.toHaveBeenCalled();
});
