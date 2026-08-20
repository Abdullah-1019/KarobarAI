import type { ComponentType } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  KeyRound,
  MapPin,
  Package,
  PackageCheck,
  RotateCcw,
  Truck,
  Wallet,
  XCircle,
  type LucideProps,
} from 'lucide-react';

interface EventMeta {
  icon: ComponentType<LucideProps>;
  fg: string;
  bg: string;
}

// E6 — no icon-hint field exists on NotificationDTO (packages/shared/src/types/notification.ts),
// so this mapping is purely presentational, keyed by the real eventType values the backend
// actually sends (notification.service.ts's dispatch list) — nothing invented, no icon for an
// event type that doesn't exist. Colors reuse the same semantic tokens StatusTag draws from
// rather than a new palette, kept muted (soft-tint backgrounds) so the list stays calm — only
// genuinely exceptional events (cancellation, manual-logistics fallback) get a warning/error tint.
const EVENT_META: Record<string, EventMeta> = {
  ORDER_PLACED: { icon: Package, fg: 'var(--info)', bg: 'var(--info-soft)' },
  ORDER_PAYMENT_CONFIRMED: { icon: PackageCheck, fg: 'var(--success)', bg: 'var(--success-soft)' },
  ORDER_CANCELLED: { icon: XCircle, fg: 'var(--error)', bg: 'var(--error-soft)' },
  ORDER_PICKED_UP: { icon: Truck, fg: 'var(--info)', bg: 'var(--info-soft)' },
  ORDER_IN_TRANSIT: { icon: Truck, fg: 'var(--info)', bg: 'var(--info-soft)' },
  ORDER_OUT_FOR_DELIVERY: { icon: MapPin, fg: 'var(--warning)', bg: 'var(--warning-soft)' },
  ORDER_DELIVERED: { icon: CheckCircle2, fg: 'var(--success)', bg: 'var(--success-soft)' },
  COURIER_MANUAL_LOGISTICS: { icon: AlertTriangle, fg: 'var(--warning)', bg: 'var(--warning-soft)' },
  TRACKING_POLL_FAILURE: { icon: AlertTriangle, fg: 'var(--warning)', bg: 'var(--warning-soft)' },
  OTP_REQUESTED: { icon: KeyRound, fg: 'var(--text-secondary)', bg: 'var(--bg-sunken)' },
  RETURN_DECISION: { icon: RotateCcw, fg: 'var(--info)', bg: 'var(--info-soft)' },
  REFUND_ISSUED: { icon: Wallet, fg: 'var(--success)', bg: 'var(--success-soft)' },
};
const DEFAULT_META: EventMeta = { icon: Bell, fg: 'var(--text-secondary)', bg: 'var(--bg-sunken)' };

interface NotificationIconProps {
  eventType: string;
}

export function NotificationIcon({ eventType }: NotificationIconProps) {
  const { icon: Icon, fg, bg } = EVENT_META[eventType] ?? DEFAULT_META;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: bg,
        color: fg,
        flexShrink: 0,
      }}
    >
      <Icon size={18} />
    </span>
  );
}
