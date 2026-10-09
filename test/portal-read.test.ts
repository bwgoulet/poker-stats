import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const fixtures = vi.hoisted(() => ({ getPortalData: vi.fn() }));
vi.mock('@/lib/backend/repository', () => ({ getPortalData: fixtures.getPortalData }));
import { GET } from '@/app/api/portal/route';
const league = '00000000-0000-4000-8000-000000000001';
beforeEach(() => vi.clearAllMocks());
it('pins refresh to the editor league instead of a shared browser cookie', async () => {
  fixtures.getPortalData.mockResolvedValue({ selectedLeagueId: league });
  const response = await GET(new NextRequest(`http://localhost:3000/api/portal?leagueId=${league}`));
  expect(response.status).toBe(200);
  expect(fixtures.getPortalData).toHaveBeenCalledExactlyOnceWith(league);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
it('does not silently read another league when access to the pinned league is lost', async () => {
  fixtures.getPortalData.mockResolvedValue({ selectedLeagueId: null });
  const response = await GET(new NextRequest(`http://localhost:3000/api/portal?leagueId=${league}`));
  expect(response.status).toBe(403);
});
it('rejects malformed league selectors before querying', async () => {
  expect((await GET(new NextRequest('http://localhost:3000/api/portal?leagueId=invalid'))).status).toBe(400);
  expect(fixtures.getPortalData).not.toHaveBeenCalled();
});
