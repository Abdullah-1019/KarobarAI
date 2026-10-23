// Money formatting for the analytics widgets: hero figures split the paisa so it can be muted,
// axis ticks use compact notation (Rs 12K).
export function formatRupees(amount: number): { whole: string; fraction: string } {
  const [whole, fraction = '00'] = amount.toFixed(2).split('.');
  return { whole: `Rs ${Number(whole).toLocaleString('en-PK')}`, fraction: `.${fraction}` };
}

export function formatCompactRupees(amount: number): string {
  return `Rs ${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(amount)}`;
}

// Backend days are plain YYYY-MM-DD; parse as local dates so weekdays never shift by timezone.
export function parseDay(date: string): Date {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}
