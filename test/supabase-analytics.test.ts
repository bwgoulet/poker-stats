import { describe, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/backend/supabase', () => ({ supabaseConfig: () => null, serverSupabase: vi.fn() }));
import { portalToPokerData } from '@/lib/backend/repository';
import { buildWorkbookImport } from '@/lib/backend/import-workbooks';
import { historicalData } from './helpers/historical-data';
import { UNC_LEAGUE_ID, type PortalData } from '@/lib/backend/types';
import type { PlayerResult } from '@/types/poker';

function historicalPortal(normalized = historicalData()): PortalData {
  const imported = buildWorkbookImport(normalized);
  return {
    configured: true, user: null, selectedLeagueId: UNC_LEAGUE_ID,
    leagues: [{ id: UNC_LEAGUE_ID, name: 'UNC Poker', slug: 'unc-poker', currency: 'USD', timezone: 'America/New_York', visibility: 'public', role: null }],
    players: imported.players,
    games: imported.games.map(game => ({ ...game, leagueId: UNC_LEAGUE_ID, version: 1 })),
  };
}
const comparable = (rows: PlayerResult[]) => new Map(rows.map(({ nightId, playerId, buyIn, cashOut, profit, placement }) => [`${nightId}/${playerId}`, { buyIn, cashOut, profit, placement }]));

describe('database analytics adapter', () => {
  it('preserves all historical results and tie placements after migration', () => {
    const normalized = historicalData();
    const adapted = portalToPokerData(historicalPortal(normalized));
    expect(comparable(adapted.results)).toEqual(comparable(normalized.results));
    expect(adapted.players).toEqual(normalized.players);
    expect(new Set(adapted.nights.map(night => night.id))).toEqual(new Set(normalized.nights.map(night => night.id)));
    expect(adapted.nights.map(night => night.date)).toEqual(adapted.nights.map(night => night.date).sort());
  }, 15000);
  it('excludes draft results and retains tournament format', () => {
    const portal = historicalPortal();
    portal.games[0].status = 'draft';
    portal.games[1].format = 'tournament';
    const adapted = portalToPokerData(portal);
    expect(adapted.nights.some(night => night.id === portal.games[0].id)).toBe(false);
    expect(adapted.results.some(result => result.nightId === portal.games[0].id)).toBe(false);
    expect(adapted.nights.find(night => night.id === portal.games[1].id)?.format).toBe('tournament');
  });
});
