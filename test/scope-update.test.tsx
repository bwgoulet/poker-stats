import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: '', drafts: [] as unknown[], stateIndex: 0, assign: vi.fn(), dispatchEvent: vi.fn(),
}));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: () => {},
  useState: (initial: unknown) => [mocks.drafts[mocks.stateIndex++] ?? initial, vi.fn()],
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/players',
  useSearchParams: () => new URLSearchParams(mocks.query),
}));
vi.mock('@/components/layout/NavigationLoader', () => ({ navigationStartEvent: 'poker:navigation-start' }));
import { GlobalFilterBar } from '@/components/filters/GlobalFilterBar';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query = '';
  mocks.drafts = [];
  mocks.stateIndex = 0;
  vi.stubGlobal('window', { location: { assign: mocks.assign }, dispatchEvent: mocks.dispatchEvent });
});
afterEach(() => vi.unstubAllGlobals());

function findUpdate(node: ReactNode): ReactElement<{ disabled: boolean; onClick: () => void }> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) { const match = findUpdate(child); if (match) return match; }
  }
  if (!isValidElement<{ children?: ReactNode; disabled: boolean; onClick: () => void }>(node)) return;
  if (node.type === 'button' && node.props.children === 'Update Scope') return node;
  return findUpdate(node.props.children);
}

it('reloads the full page with every applied scope selection and resets pagination', () => {
  mocks.query = 'season=fall-2025&nightType=10&minNights=1&page=9&player=a&player=b';
  mocks.drafts = [['spring-2026'], ['20', '50'], 5];
  const button = findUpdate(GlobalFilterBar({ seasonIds: ['spring-2026', 'fall-2025'] }))!;
  expect(button.props.disabled).toBe(false);
  button.props.onClick();
  expect(mocks.dispatchEvent).toHaveBeenCalledOnce();
  const destination = new URL(mocks.assign.mock.calls[0][0], 'https://poker.example');
  expect(destination.pathname).toBe('/players');
  expect(destination.searchParams.getAll('season')).toEqual(['spring-2026']);
  expect(destination.searchParams.getAll('nightType')).toEqual(['20', '50']);
  expect(destination.searchParams.get('minNights')).toBe('5');
  expect(destination.searchParams.has('page')).toBe(false);
  expect(destination.searchParams.getAll('player')).toEqual(['a', 'b']);
});

it.each([[[], ['10'], 1], [['spring-2026'], [], 1]])('does not apply an empty selection', (seasons, types, minimum) => {
  mocks.drafts = [seasons, types, minimum];
  const button = findUpdate(GlobalFilterBar({ seasonIds: ['spring-2026'] }))!;
  expect(button.props.disabled).toBe(true);
  button.props.onClick();
  expect(mocks.assign).not.toHaveBeenCalled();
});

it('uses the same repeated and comma-separated query parsing as server statistics', () => {
  mocks.query = 'season=spring-2026,fall-2025&nightType=10&nightType=20,50&minNights=3&minNights=5';
  const button = findUpdate(GlobalFilterBar({ seasonIds: ['spring-2026', 'fall-2025'] }))!;
  expect(button.props.disabled).toBe(true);
  button.props.onClick();
  expect(mocks.assign).not.toHaveBeenCalled();
});
