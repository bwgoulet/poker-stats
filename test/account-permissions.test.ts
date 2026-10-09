import { describe, expect, it } from 'vitest';
import { accountReturnTo } from '@/lib/backend/account';
import { canAdmin, canEdit, effectiveLeagueRole, type AppUser } from '@/lib/backend/types';

const player: AppUser = { id: 'user', displayName: 'Player', email: 'player@example.test', role: 'player' };
const admin: AppUser = { ...player, role: 'admin' };
describe('effective management access', () => {
  it('app admins can manage games without explicit memberships', () => {
    expect(canEdit(effectiveLeagueRole(admin, null))).toBe(true);
    expect(canAdmin(effectiveLeagueRole(admin, 'viewer'))).toBe(true);
  });
  it('retains actual owner access and normal league roles', () => {
    expect(effectiveLeagueRole(admin, 'owner')).toBe('owner');
    expect(effectiveLeagueRole(player, 'scorekeeper')).toBe('scorekeeper');
    expect(effectiveLeagueRole(player, 'admin')).toBe('admin');
    expect(canEdit(effectiveLeagueRole(player, 'viewer'))).toBe(false);
    expect(canEdit(effectiveLeagueRole(player, null))).toBe(false);
  });
});
describe('account return destinations', () => {
  it.each(['/account', '/manage', '/players/alice', '/players/unc_player-1'])('allows %s', value => expect(accountReturnTo(value)).toBe(value));
  it.each([undefined, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/players/../admin', '/players/alice?next=https://evil.test', '/api/portal/auth', '/players/alice#hash'])('rejects %s', value => expect(accountReturnTo(value)).toBe('/account'));
  it('handles repeated query parameters without coercing them to a destination', () => {
    expect(accountReturnTo(['/players/alice'])).toBe('/account');
  });
});
