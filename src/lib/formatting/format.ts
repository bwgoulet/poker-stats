export const dollars = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—');

export const streakLabel = (streak: number) => {
  if (streak === 0) return '—';
  const count = Math.abs(streak);
  const outcome = streak > 0 ? 'win' : 'loss';
  return `${count} ${outcome}${count === 1 ? '' : outcome === 'win' ? 's' : 'es'}`;
};

export const ordinal = (n: number) => {
  if (!Number.isFinite(n)) return '—';
  const value = Math.round(n);
  const lastTwo = Math.abs(value) % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[Math.abs(value) % 10] ?? 'th');
  return `${value}${suffix}`;
};

const formatDate = (date: string, month: 'short' | 'long') =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month,
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

export const dateFmt = (date: string) => formatDate(date, 'short');
export const longDateFmt = (date: string) => formatDate(date, 'long');
