export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** Foreground colour per status variant — for callers (timelines, charts) that colour their own marks. */
export const STATUS_VARIANT_COLOR: Record<StatusVariant, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  info: 'var(--info)',
  neutral: 'var(--text-secondary)',
};
