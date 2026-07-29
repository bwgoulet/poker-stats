export const dollars = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—');

const formatDate = (date: string, month: 'short' | 'long') =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month,
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

export const dateFmt = (date: string) => formatDate(date, 'short');
export const longDateFmt = (date: string) => formatDate(date, 'long');
