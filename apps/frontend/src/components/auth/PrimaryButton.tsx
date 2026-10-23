import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  /** Text shown while loading (defaults to the button's own label). */
  loadingLabel?: string;
  /** Done state: green with a popped check; the button is inert while it shows. */
  success?: boolean;
  children: ReactNode;
}

// Full-width primary action: 48px pill, brand persimmon, with a spinner that replaces the label while a
// request is in flight and an aria-busy flag for assistive tech.
export function PrimaryButton({
  loading = false,
  loadingLabel,
  success = false,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className={className ? `kaBtn ${className}` : 'kaBtn'}
      disabled={disabled || loading || success}
      aria-busy={loading || undefined}
      data-state={success ? 'success' : undefined}
      {...rest}
    >
      {success ? (
        <>
          <Check size={18} strokeWidth={2.5} aria-hidden="true" />
          <span>{children}</span>
        </>
      ) : loading ? (
        <>
          <span className="kaSpinner" aria-hidden="true" />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
