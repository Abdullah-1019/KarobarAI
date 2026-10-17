import type { ComponentType } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Info, XCircle, type LucideProps } from 'lucide-react';

import type { StatusVariant } from './statusVariants';

export type { StatusVariant } from './statusVariants';

interface StatusTagProps {
  variant: StatusVariant;
  label: string;
  /** Overrides the variant's default icon — most callers don't need this. */
  icon?: ComponentType<LucideProps>;
}

const VARIANT_ICON: Record<StatusVariant, ComponentType<LucideProps>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  neutral: Circle,
};

// Core status pill shared by every domain status display (orders, returns, products, users).
// Tonal fill + icon + label, so status never rides on colour alone. Styling lives in global.css
// (.status-tag) on the Studio Light status tokens.
export function StatusTag({ variant, label, icon }: StatusTagProps) {
  const Icon = icon ?? VARIANT_ICON[variant];

  return (
    <span className={`status-tag status-tag--${variant}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
