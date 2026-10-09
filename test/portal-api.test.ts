import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), configured: true,
}));
vi.mock('@/lib/backend/supabase', () => ({
  supabaseConfig: () => mocks.configured ? { url: 'https://example.supabase.co', key: 'public-test-key' } : null,
  serverSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
import { POST } from '@/app/api/portal/games/route';
import { DELETE } from '@/app/api/portal/games/[id]/route';

const leagueId = '00000000-0000-4000-8000-000000000001';
const game = { title: 'Friday', date: '2026-10-09', seasonId: 'fall-2026', nightType: '20', format: 'cash', status: 'draft', notes: '', results: [] };
function request(body: unknown, origin = 'http://localhost:3000', method = 'POST') {
  return new NextRequest('http://localhost:3000/api/portal/games', { method, headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.configured = true;
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { id: 'game-id', version: 1 }, error: null });
});
describe('game mutation boundary', () => {
  it('passes validated league/game data to one atomic RPC', async () => {
    const response = await POST(request({ leagueId, game }));
    expect(response.status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('save_game', { p_league_id: leagueId, p_game: game });
  });
  it('rejects another origin before checking credentials or writing', async () => {
    expect((await POST(request({ leagueId, game }, 'https://unrelated.example'))).status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('requires a verified session', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request({ leagueId, game }))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not simulate a save without Supabase', async () => {
    mocks.configured = false;
    expect((await POST(request({ leagueId, game }))).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects a tampered profit before reaching the database', async () => {
    expect((await POST(request({ leagueId, game: { ...game, profit: 1000 } }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('returns a conflict on an outdated game version', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'stale' } });
    expect((await POST(request({ leagueId, game }))).status).toBe(409);
  });
  it('returns forbidden when Postgres rejects the role', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    expect((await POST(request({ leagueId, game }))).status).toBe(403);
  });
  it('does not expose internal errors', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'internal-secret-value' } });
    const response = await POST(request({ leagueId, game }));
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('internal-secret-value');
  });
  it('requires a version when deleting and passes it through', async () => {
    const context = { params: Promise.resolve({ id: 'game-id' }) };
    expect((await DELETE(request({ leagueId }, undefined, 'DELETE'), context)).status).toBe(400);
    const response = await DELETE(request({ leagueId, expectedVersion: 3 }, undefined, 'DELETE'), context);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenLastCalledWith('delete_game', { p_league_id: leagueId, p_game_id: 'game-id', p_expected_version: 3 });
  });
});
