import type { ComponentType } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Info, XCircle, type LucideProps } from 'lucide-react';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusTagProps {
  variant: StatusVariant;
  label: string;
  /** Overrides the variant's default icon — most callers don't need this. */
  icon?: ComponentType<LucideProps>;
}

const VARIANT_STYLE: Record<StatusVariant, { fg: string; bg: string; icon: ComponentType<LucideProps> }> = {
  success: { fg: 'var(--success)', bg: 'var(--success-soft)', icon: CheckCircle2 },
  warning: { fg: 'var(--warning)', bg: 'var(--warning-soft)', icon: AlertTriangle },
  error: { fg: 'var(--error)', bg: 'var(--error-soft)', icon: XCircle },
  info: { fg: 'var(--info)', bg: 'var(--info-soft)', icon: Info },
  neutral: { fg: 'var(--text-secondary)', bg: 'var(--bg-sunken)', icon: Circle },
};

// Exposed so other status-driven visuals (e.g. TrackingTimeline's dot color) can key off the same
// semantic color a status's StatusTag would use, without re-deriving a second mapping.
export const STATUS_VARIANT_COLOR: Record<StatusVariant, string> = Object.fromEntries(
  Object.entries(VARIANT_STYLE).map(([variant, style]) => [variant, style.fg]),
) as Record<StatusVariant, string>;

// The single source of truth for status display across the app (UIUX §5.2, §13, §17, §23) —
// consolidates what used to be four separate, independently color-mapped components
// (StatusChip, ProductStatusTag, OrderStatusTag, ReturnStatusTag). Domain-specific
// enum -> {variant, label} mapping stays in each feature (that's business/domain data, not UI);
// this component owns only the presentation: semantic tokens, icon + label pairing (never color
// alone), sizing, and RTL (plain flex row — no manual mirroring needed, direction:rtl flips it
// for free since the icon itself is non-directional per §7).
export function StatusTag({ variant, label, icon }: StatusTagProps) {
  const style = VARIANT_STYLE[variant];
  const Icon = icon ?? style.icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-1)',
        // Logical properties (UIUX §10/§31) — the icon always sits on the "start" side and the
        // tighter padding always belongs to it, regardless of LTR/RTL flex-row mirroring.
        paddingInlineStart: 'var(--sp-2)',
        paddingInlineEnd: 'var(--sp-3)',
        paddingBlock: '2px',
        borderRadius: 'var(--radius-pill)',
        background: style.bg,
        color: style.fg,
        fontSize: 'var(--fs-xs)',
        fontWeight: 500,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
