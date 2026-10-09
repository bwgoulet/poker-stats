import { classifyNightType } from '@/lib/filters/night-types';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { NightType, PlayerResult, ValidationIssue } from '@/types/poker';
import { serverSupabase, supabaseConfig } from './supabase';
import { UNC_LEAGUE_ID, effectiveLeagueRole, type AppUser, type League, type LeagueRole, type ManagedGame, type ManagedPlayer, type ManagedResult, type PlayerLink, type PlayerLinkState, type PortalData } from './types';

export const LEAGUE_COOKIE = 'poker-active-league';
const unc: League = { id: UNC_LEAGUE_ID, slug: 'unc-poker', name: 'UNC Poker', currency: 'USD', timezone: 'America/New_York', visibility: 'public', role: null };
const noLeague: League = { ...unc, id: '', slug: '', name: 'Poker leagues', visibility: 'private' };
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

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  if (!supabaseConfig()) return null;
  const client = await serverSupabase();
  const { data: auth, error } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError'
    && !(error.name === 'AuthApiError' && [400, 401, 403].includes(error.status ?? 0))) throw new Error('Unable to verify your session.');
  if (!auth.user) return null;
  const { data: profile, error: profileError } = await client.from('users').select('id,email,display_name,role').eq('id', auth.user.id).single();
  if (profileError || !profile || !['player', 'admin'].includes(profile.role)) throw new Error('Unable to load your account profile. Apply the user profiles migration.');
  return { id: profile.id, email: profile.email, displayName: profile.display_name, role: profile.role };
});

export const getMyPlayerLinks = cache(async (): Promise<PlayerLink[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const client = await serverSupabase();
  const rows = await readAll<{ league_id: string; player_id: string; league: { name: string } | null; player: { display_name: string } | null }>(() =>
    client.from('player_links').select('league_id,player_id,league:leagues(name),player:players(display_name)').eq('user_id', user.id).order('league_id'));
  return rows.map(row => ({ leagueId: row.league_id, playerId: row.player_id,
    leagueName: row.league?.name ?? 'Private league', playerName: row.player?.display_name ?? 'Linked player',
    accessible: !!row.league && !!row.player }));
});

export const getPlayerLinkState = cache(async (leagueId: string, playerId: string): Promise<PlayerLinkState | null> => {
  if (!supabaseConfig()) return null;
  const { data, error } = await (await serverSupabase()).rpc('get_player_link_state', { p_league_id: leagueId, p_player_id: playerId });
  if (error) throw new Error('Unable to load the player page link.');
  return data as PlayerLinkState;
});

export const getPortalData = cache(async (requestedLeagueId?: string): Promise<PortalData> => {
  if (!supabaseConfig()) {
    throw new Error('League data requires Supabase. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the hosting environment.');
  }
  const client = await serverSupabase();
  const user = await getCurrentUser();
  const [leagueRows, memberships] = await Promise.all([
    readAll<LeagueRow>(() => client.from('leagues').select('*').order('name').order('id')),
    user ? readAll<{ league_id: string; role: LeagueRole }>(() => client.from('league_members').select('league_id,role').eq('user_id', user.id).order('league_id')) : Promise.resolve([]),
  ]);
  const leagues = leagueRows.map(row => ({ ...row, role: effectiveLeagueRole(user, memberships.find(member => member.league_id === row.id)?.role ?? null) }));
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
    id: row.id, leagueId: row.league_id, title: row.title, date: row.date, seasonId: row.season_id, nightType: classifyNightType(row.night_type, row.title),
    format: row.format, status: row.status, notes: row.notes ?? '', version: row.version, sourceRef: row.source_ref,
    results: row.results.map(result => ({ playerId: result.player_id, buyInCents: result.buy_in_cents, cashOutCents: result.cash_out_cents, placement: result.placement, legacyProfitCents: result.legacy_profit_cents })),
  }));
  return { configured: true, user, leagues, selectedLeagueId: league.id, players, games };
});

export const getActivePokerData = cache(async () => {
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
    nights: games.map(game => ({ id: game.id, date: game.date, title: game.title, seasonId: game.seasonId, nightType: classifyNightType(game.nightType, game.title), format: game.format, notes: game.notes })),
  };
}
const profit = (result: ManagedResult) => result.legacyProfitCents ?? (result.cashOutCents ?? 0) - result.buyInCents;
