import { cache } from 'react';
import { cookies } from 'next/headers';
import { normalizeWorkbooks } from '@/lib/data/normalize-workbooks';
import type { NightType, PlayerResult, ValidationIssue } from '@/types/poker';
import { serverSupabase, supabaseConfig } from './supabase';
import { UNC_LEAGUE_ID, type League, type LeagueRole, type ManagedGame, type ManagedPlayer, type ManagedResult, type PortalData } from './types';

export const LEAGUE_COOKIE = 'poker-active-league';
const unc: League = { id: UNC_LEAGUE_ID, slug: 'unc-poker', name: 'UNC Poker', currency: 'USD', timezone: 'America/New_York', visibility: 'public', role: null };
const noLeague: League = { ...unc, id: '', slug: '', name: 'Poker leagues', visibility: 'private' };
const getWorkbookData = cache(normalizeWorkbooks);
type ReadResponse = { data: unknown[] | null; error: { message: string } | null };
export async function readAll<T>(query: () => { range: (from: number, to: number) => PromiseLike<ReadResponse> }): Promise<T[]> {
  const records: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query().range(offset, offset + 999);
    if (error) throw new Error(`Unable to load league records: ${error.message}`);
    records.push(...(data ?? []) as T[]);
    if (!data || data.length < 1000) return records;
  }
}
interface LeagueRow { id: string; slug: string; name: string; currency: 'USD'; timezone: string; visibility: 'public' | 'private' }
interface PlayerRow { id: string; display_name: string; aliases: string[] }
interface GameRow { id: string; league_id: string; title: string; date: string; season_id: string; night_type: NightType; format: 'cash' | 'tournament'; status: 'draft' | 'completed'; notes: string | null; version: number; source_ref: string | null; results: ResultRow[] }
interface ResultRow { game_id: string; player_id: string; buy_in_cents: number; cash_out_cents: number | null; placement: number | null; legacy_profit_cents: number | null }

export const getPortalData = cache(async (requestedLeagueId?: string): Promise<PortalData> => {
  if (!supabaseConfig()) {
    const data = getWorkbookData();
    return {
      configured: false, user: null, leagues: [unc], selectedLeagueId: UNC_LEAGUE_ID,
      players: data.players,
      games: data.nights.map(night => ({
        id: night.id, leagueId: UNC_LEAGUE_ID, title: night.title, date: night.date, seasonId: night.seasonId,
        nightType: night.nightType, format: 'cash', status: 'completed', notes: night.notes ?? '', version: 1, sourceRef: `workbook:${night.id}`,
        results: data.results.filter(row => row.nightId === night.id).map(row => ({
          playerId: row.playerId, buyInCents: Math.round(row.buyIn * 100), cashOutCents: Math.round(row.cashOut * 100),
          placement: row.placement ?? null, legacyProfitCents: Math.round(row.profit * 100),
        })),
      })),
    };
  }
  const client = await serverSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  // A missing session is expected for public analytics; invalid sessions never grant writes.
  if (authError && !['AuthSessionMissingError', 'AuthApiError'].includes(authError.name)) throw new Error('Unable to verify your session.');
  const user = auth.user ? { id: auth.user.id, email: auth.user.email ?? null } : null;
  const [leagueRows, memberships] = await Promise.all([
    readAll<LeagueRow>(() => client.from('leagues').select('*').order('name').order('id')),
    user ? readAll<{ league_id: string; role: LeagueRole }>(() => client.from('league_members').select('league_id,role').eq('user_id', user.id).order('league_id')) : Promise.resolve([]),
  ]);
  const leagues = leagueRows.map(row => ({ ...row, role: memberships.find(member => member.league_id === row.id)?.role ?? null }));
  const selected = requestedLeagueId ?? (await cookies()).get(LEAGUE_COOKIE)?.value;
  const league = leagues.find(row => row.id === selected)
    ?? (requestedLeagueId ? undefined : leagues.find(row => row.id === UNC_LEAGUE_ID) ?? leagues[0]);
  if (!league) return { configured: true, user, leagues, selectedLeagueId: null, players: [], games: [] };
  const [playerRows, gameRows] = await Promise.all([
    readAll<PlayerRow>(() => client.from('players').select('*').eq('league_id', league.id).order('id')),
    // Embed results in the same SQL snapshot as metadata/version. Separate reads
    // could combine an old game version with a concurrently replaced result set.
    readAll<GameRow>(() => client.from('games').select('*,results:game_results(*)').eq('league_id', league.id).order('id')),
  ]);
  const players: ManagedPlayer[] = playerRows.map(row => ({ id: row.id, displayName: row.display_name, aliases: row.aliases }));
  const games: ManagedGame[] = gameRows.map(row => ({
    id: row.id, leagueId: row.league_id, title: row.title, date: row.date, seasonId: row.season_id, nightType: row.night_type,
    format: row.format, status: row.status, notes: row.notes ?? '', version: row.version, sourceRef: row.source_ref,
    results: row.results.map(result => ({ playerId: result.player_id, buyInCents: result.buy_in_cents, cashOutCents: result.cash_out_cents, placement: result.placement, legacyProfitCents: result.legacy_profit_cents })),
  }));
  return { configured: true, user, leagues, selectedLeagueId: league.id, players, games };
});

export const getActivePokerData = cache(async () => {
  if (!supabaseConfig()) return { ...getWorkbookData(), league: unc, source: 'workbooks' as const };
  return portalToPokerData(await getPortalData());
});

export function portalToPokerData(portal: PortalData) {
  const league = portal.leagues.find(row => row.id === portal.selectedLeagueId) ?? noLeague;
  const games = portal.games.filter(game => game.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const players = portal.players;
  const names = new Map(players.map(player => [player.id, player.displayName]));
  const results: PlayerResult[] = [];
  const issues: ValidationIssue[] = [];
  games.forEach(game => {
    const ordered = [...game.results].sort((a, b) => profit(b) - profit(a));
    ordered.forEach((row, index) => results.push({
      nightId: game.id, playerId: row.playerId, buyIn: row.buyInCents / 100, cashOut: (row.cashOutCents ?? 0) / 100,
      profit: profit(row) / 100, placement: row.placement ?? index + 1,
      sourceName: names.get(row.playerId) ?? row.playerId,
    }));
    const imbalance = game.results.reduce((sum, row) => sum + row.buyInCents - (row.cashOutCents ?? 0), 0);
    if (imbalance || game.results.some(row => row.legacyProfitCents != null && row.legacyProfitCents !== (row.cashOutCents ?? 0) - row.buyInCents)) {
      issues.push({ workbook: game.sourceRef ?? 'Supabase', sheet: game.id, row: 0, severity: 'warning', message: 'Imported historical game needs financial review; original recorded profits are preserved.' });
    }
  });
  return {
    players, results, issues, league, source: 'supabase' as const,
    nights: games.map(game => ({ id: game.id, date: game.date, title: game.title, seasonId: game.seasonId, nightType: game.nightType, format: game.format, notes: game.notes })),
  };
}
const profit = (result: ManagedResult) => result.legacyProfitCents ?? (result.cashOutCents ?? 0) - result.buyInCents;
