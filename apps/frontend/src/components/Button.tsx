import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'cta' | 'outline' | 'outline-saffron' | 'ghost' | 'danger-ghost' | 'outline-light';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  /** primary = emerald fill; cta = saffron fill; outline/ghost = emerald on transparent;
   * danger-ghost = error text on transparent (destructive secondary); outline-saffron = saffron
   * border/text (Become a Seller); outline-light = white outline, for use on the emerald hero. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a client-side `<Link>` instead of a `<button>`. */
  to?: string;
  /** Renders an anchor instead of a `<button>`. */
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** Shows an inline spinner and blocks interaction without changing the button width. */
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
}

// Branded call-to-action button — the four variants from the Home spec (primary, CTA, outline,
// ghost) at a 48px (≥44) touch height with the shared focus ring and hover/press motion. Distinct
// from AntD's `Button`, which stays in use for dense/app-chrome controls (tables, toolbars); this
// one is for marketing surfaces. Renders as a router Link or anchor when `to`/`href` is given so
// navigation stays keyboard- and middle-click-correct instead of nesting a button in an anchor.
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  to,
  href,
  onClick,
  type = 'button',
  disabled,
  loading,
  icon,
  iconPosition = 'start',
  fullWidth,
  className,
  'aria-label': ariaLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'lg' && 'btn--lg',
    size === 'sm' && 'btn--sm',
    loading && 'btn--loading',
    fullWidth && 'btn--full',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : (
        icon && iconPosition === 'start' && <span className="btn__icon">{icon}</span>
      )}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'end' && <span className="btn__icon">{icon}</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={ariaLabel} aria-disabled={isDisabled} aria-busy={loading}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} aria-label={ariaLabel} aria-disabled={isDisabled} aria-busy={loading}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={classes} onClick={onClick} disabled={isDisabled} aria-label={ariaLabel} aria-busy={loading}>
      {content}
    </button>
  );
}
