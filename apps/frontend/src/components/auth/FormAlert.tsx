import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export type FormAlertVariant = 'error' | 'success' | 'info';

export interface FormAlertProps {
  variant?: FormAlertVariant;
  children: ReactNode;
}

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info } as const;

// Inline status message for a form (submit failure, success banner, guidance). role="alert" so a
// message that appears after an action is announced.
export function FormAlert({ variant = 'error', children }: FormAlertProps) {
  const Icon = ICONS[variant];

  return (
    <div className={`kaAlert kaAlert--${variant}`} role="alert">
      <Icon className="kaAlertIcon" size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
