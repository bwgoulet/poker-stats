import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), signUp: vi.fn(), rpc: vi.fn(), exchange: vi.fn(), verifyOtp: vi.fn(), configured: true }));
vi.mock('@/lib/backend/supabase', () => ({
  supabaseConfig: () => mocks.configured ? { url: 'https://example.supabase.co', key: 'test-public-key' } : null,
  serverSupabase: async () => ({ auth: { getUser: mocks.getUser, signUp: mocks.signUp, exchangeCodeForSession: mocks.exchange, verifyOtp: mocks.verifyOtp }, rpc: mocks.rpc }),
}));
import { POST as signup } from '@/app/api/portal/auth/signup/route';
import { POST as claim, DELETE as unlink } from '@/app/api/portal/player-links/route';
import { GET as callback } from '@/app/auth/callback/route';

const leagueId = '00000000-0000-4000-8000-000000000001';
const credentials = { email: 'alice@example.test', password: 'test-password', displayName: 'Alice' };
function request(body: unknown, origin = 'http://localhost:3000', method = 'POST') {
  return new NextRequest('http://localhost:3000/api/portal/account', { method, headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.configured = true;
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'account-id' } }, error: null });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.exchange.mockResolvedValue({ error: null }); mocks.verifyOtp.mockResolvedValue({ error: null });
});

describe('account signup boundary', () => {
  it('submits only display metadata and a same-origin confirmation URL', async () => {
    const response = await signup(request({ ...credentials, displayName: '  Alice  ', next: '/players/alice' }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ signedIn: false });
    expect(mocks.signUp).toHaveBeenCalledExactlyOnceWith({ email: credentials.email, password: credentials.password,
      options: { data: { display_name: 'Alice' }, emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Fplayers%2Falice' } });
  });
  it('rejects a user-supplied admin role', async () => {
    expect((await signup(request({ ...credentials, role: 'admin' }))).status).toBe(400);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('preserves a loopback IP origin in mutations and confirmation links', async () => {
    const request = new NextRequest('http://127.0.0.1:3000/api/portal/auth/signup', { method: 'POST',
      headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
    expect((await signup(request)).status).toBe(200);
    expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe('http://127.0.0.1:3000/auth/callback?next=%2Faccount');
  });
  it('does not allow a forwarded host to bypass the origin check', async () => {
    const request = new NextRequest('https://poker.example.test/api/portal/auth/signup', { method: 'POST',
      headers: { host: 'poker.example.test', 'x-forwarded-host': 'evil.test', origin: 'https://evil.test', 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
    expect((await signup(request)).status).toBe(403); expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('rejects metadata injected into signup', async () => {
    expect((await signup(request({ ...credentials, options: { data: { role: 'admin' } } }))).status).toBe(400);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('requires the same origin and a configured backend', async () => {
    expect((await signup(request(credentials, 'https://elsewhere.test'))).status).toBe(403);
    mocks.configured = false;
    expect((await signup(request(credentials))).status).toBe(503);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('rejects a weak password before contacting Auth', async () => {
    expect((await signup(request({ ...credentials, password: 'short' }))).status).toBe(400);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it('reports an immediate session when email confirmation is disabled', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { access_token: 'masked' } }, error: null });
    expect(await (await signup(request(credentials))).json()).toEqual({ signedIn: true });
  });
  it('handles Auth rate limits without exposing provider internals', async () => {
    mocks.signUp.mockResolvedValue({ data: {}, error: { status: 429, message: 'internal-secret' } });
    const response = await signup(request(credentials));
    expect(response.status).toBe(429); expect(await response.text()).not.toContain('internal-secret');
  });
  it('handles signup failures without exposing account details', async () => {
    mocks.signUp.mockResolvedValue({ data: {}, error: { status: 422, message: 'internal-secret' } });
    const response = await signup(request(credentials));
    expect(response.status).toBe(400); expect(await response.text()).not.toContain('internal-secret');
  });
});

describe('player-page linking boundary', () => {
  it('claims the page for the server-verified session through one RPC', async () => {
    expect((await claim(request({ leagueId, playerId: 'alice' }))).status).toBe(200);
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('claim_player_page', { p_league_id: leagueId, p_player_id: 'alice' });
  });
  it('unlinks only via the caller-scoped database function', async () => {
    expect((await unlink(request({ leagueId, playerId: 'alice' }, undefined, 'DELETE'))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('unlink_player_page', { p_league_id: leagueId, p_player_id: 'alice' });
  });
  it('cannot supply a different account id', async () => {
    expect((await claim(request({ leagueId, playerId: 'alice', userId: 'someone-else' }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects anonymous and cross-origin claims', async () => {
    expect((await claim(request({ leagueId, playerId: 'alice' }, 'https://elsewhere.test'))).status).toBe(403);
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await claim(request({ leagueId, playerId: 'alice' }))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([['23505', 409], ['42501', 403], ['P0002', 404], ['XX000', 500]])('maps database %s to HTTP %s without leaking identities', async (code, status) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: 'other-account-secret-email' } });
    const response = await claim(request({ leagueId, playerId: 'alice' }));
    expect(response.status).toBe(status); expect(await response.text()).not.toContain('other-account-secret-email');
  });
});

describe('confirmation callback', () => {
  it('exchanges a confirmation code and returns to the player page', async () => {
    const response = await callback(new NextRequest('http://localhost:3000/auth/callback?code=confirmation-code&next=%2Fplayers%2Falice'));
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith('confirmation-code');
    expect(response.headers.get('location')).toBe('http://localhost:3000/players/alice');
  });
  it('also supports the token-hash email template', async () => {
    const response = await callback(new NextRequest('http://localhost:3000/auth/callback?token_hash=confirmation-hash&type=email'));
    expect(mocks.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: 'confirmation-hash', type: 'email' });
    expect(response.headers.get('location')).toBe('http://localhost:3000/account');
  });
  it('never redirects to an external next URL', async () => {
    const response = await callback(new NextRequest('http://localhost:3000/auth/callback?code=confirmation-code&next=https%3A%2F%2Fevil.test'));
    expect(response.headers.get('location')).toBe('http://localhost:3000/account');
  });
  it('returns to the same loopback host so session cookies remain usable', async () => {
    const response = await callback(new NextRequest('http://127.0.0.1:3000/auth/callback?code=confirmed', { headers: { host: '127.0.0.1:3000' } }));
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3000/account');
  });
  it('returns a helpful login state when confirmation fails', async () => {
    mocks.exchange.mockResolvedValue({ error: { message: 'expired' } });
    const response = await callback(new NextRequest('http://localhost:3000/auth/callback?code=expired&next=%2Fplayers%2Falice'));
    const target = new URL(response.headers.get('location')!);
    expect(target.pathname).toBe('/auth/login'); expect(target.searchParams.get('confirmation')).toBe('failed');
    expect(target.searchParams.get('next')).toBe('/players/alice');
  });
});
