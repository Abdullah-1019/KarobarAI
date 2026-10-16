import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  /** Text shown while loading (defaults to the button's own label). */
  loadingLabel?: string;
  children: ReactNode;
}

// Full-width primary action: 48px, brand green, with a spinner that replaces the label while a
// request is in flight and an aria-busy flag for assistive tech.
export function PrimaryButton({
  loading = false,
  loadingLabel,
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
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
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
