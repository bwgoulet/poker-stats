import { beforeEach, expect, it, vi } from 'vitest';
const fixtures = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), configured: true }));
vi.mock('@/lib/backend/supabase', () => ({
  supabaseConfig: () => fixtures.configured ? { url: 'test', key: 'test' } : null,
  serverSupabase: async () => ({ auth: { getUser: fixtures.getUser }, from: (table: string) => {
    expect(table).toBe('users');
    return { select: () => ({ eq: (_column: string, id: string) => {
      expect(id).toBe('account-id'); return { single: fixtures.profile };
    } }) };
  } }),
}));
import { getCurrentUser } from '@/lib/backend/repository';
beforeEach(() => {
  vi.clearAllMocks(); fixtures.configured = true;
  fixtures.getUser.mockResolvedValue({ data: { user: { id: 'account-id', email: 'auth@example.test', user_metadata: { role: 'admin' } } }, error: null });
  fixtures.profile.mockResolvedValue({ data: { id: 'account-id', email: 'profile@example.test', display_name: 'Alice', role: 'player' }, error: null });
});
it('reads permissions from the database profile rather than signup metadata', async () => {
  expect(await getCurrentUser()).toEqual({ id: 'account-id', email: 'profile@example.test', displayName: 'Alice', role: 'player' });
});
it('fails visibly when a signed-in account profile is missing', async () => {
  fixtures.profile.mockResolvedValue({ data: null, error: { message: 'missing table' } });
  await expect(getCurrentUser()).rejects.toThrow('account profile');
});
it('returns no user for a missing or invalid session', async () => {
  fixtures.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthApiError', status: 401 } });
  expect(await getCurrentUser()).toBeNull(); expect(fixtures.profile).not.toHaveBeenCalled();
});
it('does not hide an Auth service failure as a signed-out session', async () => {
  fixtures.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthApiError', status: 503 } });
  await expect(getCurrentUser()).rejects.toThrow('verify your session');
});
it('does not contact Auth when database configuration is missing', async () => {
  fixtures.configured = false;
  expect(await getCurrentUser()).toBeNull(); expect(fixtures.getUser).not.toHaveBeenCalled();
});
