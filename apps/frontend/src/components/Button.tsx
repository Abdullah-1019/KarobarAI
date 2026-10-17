import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ArrowIcon } from './ArrowIcon';

type ButtonVariant =
  | 'primary'
  | 'cta'
  | 'secondary'
  | 'outline'
  | 'outline-saffron'
  | 'ghost'
  | 'icon'
  | 'danger'
  | 'danger-ghost'
  | 'outline-light';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children?: ReactNode;
  /** primary / cta = persimmon pill with its glow — the ONE main action per view (cta is the
   * marketing-size use). secondary = ink pill. outline = white pill with a hairline that turns ink
   * on hover (outline-saffron is a kept alias, used by "Become a Seller"). ghost = ink text that
   * underlines on hover. icon = 44px round button (pass `aria-label`). danger / danger-ghost =
   * destructive. outline-light = light outline for the interim ink bands only. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a client-side `<Link>` instead of a `<button>`. */
  to?: string;
  /** Renders an anchor instead of a `<button>`. */
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** Fades the label out under a centred spinner; the width stays locked. */
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  /** Trailing arrow that nudges toward the reading direction on hover (mirrors in Urdu). */
  arrow?: boolean;
  /** Ink fill for the round `icon` variant. */
  ink?: boolean;
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
}

// Branded Studio Light button (docs/frontend/DESIGN-CONSULT.md §6): pill shapes, the persimmon CTA
// with its own glow, ink secondary, outline, ghost, round icon and destructive variants, with a
// 44px default touch height (36px `sm` keeps a 44px tap halo). Motion lives in global.css: hover
// lifts 1px on fine pointers, press sinks to scale(.97) in 90ms and the release springs back.
// Distinct from AntD's `Button`, which stays for dense app chrome (tables, toolbars). Renders as a
// router Link or anchor when `to`/`href` is given, so navigation stays keyboard- and
// middle-click-correct instead of nesting a button in an anchor.
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
  arrow,
  ink,
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
    ink && 'btn--ink',
    loading && 'btn--loading',
    fullWidth && 'btn--full',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="btn__label">
        {icon && iconPosition === 'start' && <span className="btn__icon">{icon}</span>}
        {children}
        {icon && iconPosition === 'end' && <span className="btn__icon">{icon}</span>}
        {arrow && (
          <span className="btn__icon">
            <ArrowIcon size={18} strokeWidth={2} />
          </span>
        )}
      </span>
      {loading && <span className="btn__spinner" aria-hidden="true" />}
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
