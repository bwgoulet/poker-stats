import { isValidElement, type ReactNode } from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { GameInput, PortalData, ManagedGame } from '@/lib/backend/types';

const hooks = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: unknown }[], stateIndex: 0, refIndex: 0 }));
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useEffect: () => {},
  useMemo: (fn: () => unknown) => fn(),
  useRef: (initial: unknown) => hooks.refs[hooks.refIndex++] ?? (hooks.refs[hooks.refIndex - 1] = { current: initial }),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.states)) hooks.states[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks.states[index], (next: unknown) => { hooks.states[index] = typeof next === 'function' ? next(hooks.states[index]) : next; }];
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { ManagementPortal } from '@/components/manage/ManagementPortal';
import { GameEditor } from '@/components/manage/GameEditor';

const input: GameInput = { title: 'Friday', date: '2026-10-09', seasonId: 'fall-2026', nightType: '10', format: 'cash', status: 'draft', notes: '', results: [] };
const data: PortalData = { configured: true, user: { id: 'admin', email: 'admin@example.com', displayName: 'Admin', role: 'admin' }, selectedLeagueId: 'league', leagues: [{ id: 'league', name: 'Poker', slug: 'poker', currency: 'USD', timezone: 'America/New_York', visibility: 'public', role: 'owner' }], players: [], games: [] };
function findEditor(node: ReactNode): { key: string | null; props: { game: ManagedGame | null; onSave: (input: GameInput) => Promise<boolean> } } | undefined {
  if (Array.isArray(node)) return node.map(findEditor).find(Boolean);
  if (!isValidElement<{ children?: ReactNode }>(node)) return;
  if (node.type === GameEditor) return node as unknown as ReturnType<typeof findEditor>;
  return findEditor(node.props.children);
}
function render() { hooks.stateIndex = 0; hooks.refIndex = 0; return ManagementPortal({ initialData: data }); }
beforeEach(() => {
  hooks.states = []; hooks.refs = [];
  vi.stubGlobal('window', { location: { href: 'https://poker.example/manage?new=1' }, history: { replaceState: vi.fn() } });
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  render(); hooks.states[4] = { game: null };
});
afterEach(() => vi.unstubAllGlobals());

it.each([true, false])('keeps the same editor through repeated saves, including refresh success=%s', async refreshed => {
  let version = 0;
  const fetch = vi.fn(async (_url: string, options?: { method?: string; body?: string }) => {
    if (options?.method === 'POST') {
      const payload = JSON.parse(options.body!).game;
      if (version) expect(payload).toMatchObject({ id: 'saved-game', expectedVersion: version });
      else expect(payload.id).toBeUndefined();
      return { ok: true, json: async () => ({ id: 'saved-game', version: ++version }) };
    }
    if (!refreshed) throw new Error('offline');
    return { ok: true, json: async () => ({ ...data, games: [{ ...input, id: 'saved-game', version, leagueId: 'league', sourceRef: null }] }) };
  });
  vi.stubGlobal('fetch', fetch);
  const first = findEditor(render())!;
  expect(await first.props.onSave(input)).toBe(true);
  const second = findEditor(render())!;
  expect(second.key).toBe(first.key);
  expect(second.props.game).toMatchObject({ id: 'saved-game', version: 1 });
  expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/manage?gameId=saved-game');
  expect(await second.props.onSave({ ...input, id: second.props.game!.id, expectedVersion: second.props.game!.version, notes: 'Rebuy' })).toBe(true);
  expect(findEditor(render())!.props.game).toMatchObject({ id: 'saved-game', version: 2, notes: 'Rebuy' });
});

it('keeps the editor open when saving fails and closes it after completion', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Conflict' }) }));
  const editor = findEditor(render())!;
  expect(await editor.props.onSave(input)).toBe(false);
  expect(findEditor(render())!.props.game).toBeNull();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'saved-game', version: 1 }) }).mockRejectedValue(new Error('offline')));
  expect(await findEditor(render())!.props.onSave({ ...input, status: 'completed' })).toBe(true);
  expect(findEditor(render())).toBeUndefined();
});
