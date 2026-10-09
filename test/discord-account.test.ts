import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ oauth: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), configured: true }));
vi.mock('@/lib/backend/supabase', () => ({
  supabaseConfig: () => mocks.configured ? { url: 'https://example.supabase.co', key: 'public' } : null,
  serverSupabase: async () => ({ auth: { signInWithOAuth: mocks.oauth, getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
import { POST as discord } from '@/app/api/portal/auth/discord/route';
import { POST as review, DELETE as cancel } from '@/app/api/portal/link-requests/route';
import { POST as onboarding } from '@/app/api/portal/account-onboarding/route';
function request(body: unknown, origin = 'https://poker.example') {
  return new NextRequest('https://poker.example/api/portal/auth/discord', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.configured = true;
  mocks.oauth.mockResolvedValue({ data: { url: 'https://discord.com/oauth2/authorize' }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'verified-account' } }, error: null });
  mocks.rpc.mockResolvedValue({ error: null });
});
it('starts Discord OAuth with a safe return path and server cookie flow', async () => {
  expect((await discord(request({ next: 'https://evil.example' }))).status).toBe(200);
  expect(mocks.oauth).toHaveBeenCalledExactlyOnceWith({ provider: 'discord', options: { redirectTo: 'https://poker.example/auth/callback?next=%2Faccount', scopes: 'identify email', skipBrowserRedirect: true } });
});
it('allows Discord sign-in for a new anonymous account', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await discord(request({}))).status).toBe(200);
  expect(mocks.getUser).not.toHaveBeenCalled();
});
it('rejects cross-origin OAuth starts before contacting the provider', async () => {
  expect((await discord(request({}, 'https://evil.example'))).status).toBe(403);
  expect(mocks.oauth).not.toHaveBeenCalled();
});
it('reports missing account configuration', async () => {
  mocks.configured = false;
  expect((await discord(request({}))).status).toBe(503);
});
it('handles disabled Discord without disclosing provider secrets', async () => {
  mocks.oauth.mockResolvedValue({ data: {}, error: { message: 'secret' } });
  const result = await discord(request({}));
  expect(result.status).toBe(503); expect(await result.text()).not.toContain('secret');
});
it('uses a caller-scoped review RPC with a strict decision', async () => {
  const requestId = '00000000-0000-4000-8000-000000000001';
  expect((await review(request({ requestId, approve: true }))).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('review_player_link_v2', { p_request_id: requestId, p_approve: true });
  expect((await review(request({ requestId, approve: true, userId: 'victim' }))).status).toBe(400);
});
it('maps racing approvals to a useful conflict', async () => {
  mocks.rpc.mockResolvedValue({ error: { code: '23505', message: 'private account email' } });
  const result = await review(request({ requestId: '00000000-0000-4000-8000-000000000001', approve: true }));
  expect(result.status).toBe(409); expect(await result.text()).not.toContain('private account email');
});
it('persists no link without allowing another user id', async () => {
  expect((await onboarding(request({ choice: 'no_link' }))).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('set_account_onboarding', { p_choice: 'no_link' });
  expect((await onboarding(request({ choice: 'no_link', userId: 'victim' }))).status).toBe(400);
});
it('requires a verified session for review and onboarding', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await onboarding(request({ choice: 'no_link' }))).status).toBe(401);
  expect((await review(request({ requestId: '00000000-0000-4000-8000-000000000001', approve: true }))).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('cancels only through a session-scoped RPC', async () => {
  const requestId = '00000000-0000-4000-8000-000000000001';
  expect((await cancel(request({ requestId }))).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('cancel_player_link_request', { p_request_id: requestId });
  expect((await cancel(request({ requestId, userId: 'victim' }))).status).toBe(400);
});

for (const code of ['PGRST202', '42883']) {
  it(`reports the missing review migration instead of falling back to the old self-review rule (${code})`, async () => {
    mocks.rpc.mockResolvedValue({ error: { code, message: 'private database details' } });
    const result = await review(request({ requestId: '00000000-0000-4000-8000-000000000001', approve: true }));
    expect(result.status).toBe(503);
    const body = await result.json();
    expect(body.error).toContain('202610090007');
    expect(body.error).not.toContain('private database details');
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('review_player_link_v2', {
      p_request_id: '00000000-0000-4000-8000-000000000001', p_approve: true,
    });
  });
}
it('keeps actual league permission denials forbidden without disclosing database details', async () => {
  mocks.rpc.mockResolvedValue({ error: { code: '42501', message: 'private database details' } });
  const result = await review(request({ requestId: '00000000-0000-4000-8000-000000000001', approve: true }));
  expect(result.status).toBe(403);
  const body = await result.json();
  expect(body.error).toContain('owner/admin of this league');
  expect(body.error).not.toContain('private database details');
});
it('rejects cross-origin link reviews before calling the database', async () => {
  expect((await review(request({ requestId: '00000000-0000-4000-8000-000000000001', approve: true }, 'https://evil.example'))).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
