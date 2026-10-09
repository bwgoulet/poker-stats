import { expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/backend/supabase', () => ({ supabaseConfig: () => null, serverSupabase: vi.fn() }));
import { readAll } from '@/lib/backend/repository';

it('loads every result beyond Supabase default 1000-row pages', async () => {
  const records = Array.from({ length: 2517 }, (_, id) => ({ id }));
  const range = vi.fn(async (from: number, to: number) => ({ data: records.slice(from, to + 1), error: null }));
  expect(await readAll(() => ({ range }))).toEqual(records);
  expect(range.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
});
it('fails explicitly on a database read error', async () => {
  const range = async () => ({ data: null, error: { message: 'unavailable' } });
  await expect(readAll(() => ({ range }))).rejects.toThrow('Unable to load league records');
});
