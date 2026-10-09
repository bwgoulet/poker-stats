// Only internal destinations used by the account flow are accepted.
export function accountReturnTo(value: unknown): string {
  return typeof value === 'string' && (value === '/account' || value === '/manage' || /^\/players\/[A-Za-z0-9_-]{1,180}$/.test(value))
    ? value : '/account';
}
