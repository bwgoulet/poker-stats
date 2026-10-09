import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { parseFilters } from '@/lib/filters/filter-data';
import { scopeCookieName, scopeQuery, toSearchParams, withScope } from '@/lib/filters/scope-query';

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser } }) }));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  getUser.mockClear();
});

function request(path: string, scope?: string, league = 'league-a', headers: Record<string, string> = {}) {
  const req = new NextRequest(`https://poker.example${path}`, { headers });
  req.cookies.set('poker-active-league', league);
  if (scope) req.cookies.set(scopeCookieName(league), scope);
  return req;
}

const saved = 'season=fall-2025&season=spring-2026&nightType=20&minNights=5';

describe('persistent analytics scope', () => {
  it.each(['/dashboard', '/players', '/stats', '/games', '/compare', '/games/game-a', '/players/player-a'])('restores scope before rendering %s', async path => {
    const response = await proxy(request(`${path}?player=a&player=b&q=search`, saved));
    const destination = new URL(response.headers.get('location')!);
    expect(destination.pathname).toBe(path);
    expect(scopeQuery(destination.searchParams).toString()).toBe(saved);
    expect(destination.searchParams.getAll('player')).toEqual(['a', 'b']);
    expect(destination.searchParams.get('q')).toBe('search');
    expect(response.status).toBe(307);
  });

  it('lets an explicit URL replace saved scope and persists only scope keys', async () => {
    const response = await proxy(request('/players?season=all&nightType=10&nightType=20&minNights=1&sort=roi&player=a', saved));
    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.get(scopeCookieName('league-a'))?.value)
      .toBe('season=all&nightType=10&nightType=20&minNights=1');
  });

  it('does not update the saved selection when links are prefetched', async () => {
    const response = await proxy(request('/players?season=spring-2026', saved, 'league-a', { 'next-router-prefetch': '1' }));
    expect(response.cookies.get(scopeCookieName('league-a'))).toBeUndefined();
  });

  it.each(['/manage', '/account', '/auth/login', '/api/portal/games', '/dashboard-other'])('does not apply analytics filters to %s', async path => {
    const response = await proxy(request(path, saved));
    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.get(scopeCookieName('league-a'))).toBeUndefined();
  });

  it('keeps each league selection separate and ignores non-scope cookie keys', async () => {
    const req = request('/dashboard', undefined, 'league-b');
    req.cookies.set(scopeCookieName('league-a'), saved);
    expect((await proxy(req)).headers.get('location')).toBeNull();
    const response = await proxy(request('/dashboard', `${saved}&player=unrelated&page=99`));
    expect(new URL(response.headers.get('location')!).searchParams.has('player')).toBe(false);
  });

  it('retains session verification when scope is explicitly applied', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key');
    const response = await proxy(request(`/dashboard?${saved}`));
    expect(getUser).toHaveBeenCalledOnce();
    expect(response.cookies.get(scopeCookieName('league-a'))?.value).toBe(saved);
  });
});

describe('scope URLs', () => {
  it('round-trips multiple seasons and types while keeping comparison selections and resetting pagination', () => {
    const filters = { season: ['fall-2025', 'spring-2026'], nightType: ['10', '50'] as const, minNights: 3 };
    const query = withScope(new URLSearchParams('player=a&player=b&page=9'), { ...filters, nightType: [...filters.nightType] }, [...filters.season, 'summer-2026']);
    expect(parseFilters(Object.fromEntries([...new Set(query.keys())].map(key => [key, query.getAll(key)])), [...filters.season, 'summer-2026'])).toEqual(filters);
    expect(query.getAll('player')).toEqual(['a', 'b']);
    expect(query.has('page')).toBe(false);
  });

  it('makes the defaults explicit so resetting cannot restore an older cookie', () => {
    const filters = parseFilters({}, ['spring-2026']);
    const query = withScope(new URLSearchParams(saved), filters, ['spring-2026']);
    expect(query.get('season')).toBe('all');
    expect(query.getAll('nightType')).toEqual(['10', '20']);
    expect(query.get('minNights')).toBe('1');
    expect(parseFilters(Object.fromEntries(query), ['spring-2026', 'fall-2026']).season).toEqual(['spring-2026', 'fall-2026']);
  });

  it('preserves repeated parameters and excludes undefined values in server-generated links', () => {
    const query = toSearchParams({ season: ['spring-2026', 'fall-2025'], nightType: ['10', '50'], q: undefined });
    expect(query.getAll('season')).toEqual(['spring-2026', 'fall-2025']);
    expect(query.getAll('nightType')).toEqual(['10', '50']);
    expect(query.has('q')).toBe(false);
  });
});
