import type { ReactNode } from 'react';
import { BadgeCheck } from 'lucide-react';

type BadgeVariant = 'new' | 'sale' | 'cod' | 'verified' | 'low-stock' | 'out-of-stock';

interface BadgeProps {
  /** new = ink NEW pill; sale = red discount; cod = stone COD pill; verified = ink seal + label;
   * low-stock = red on red-soft; out-of-stock = caption grey on stone. */
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

// Small status pill for product cards (NEW / -X% / COD / Verified seller / low-stock). Colour
// comes from the `.badge--*` classes; variants are constrained by the union so a typo can't
// reach the stylesheet.
export function Badge({ variant, children, className }: BadgeProps) {
  const classes = ['badge', `badge--${variant}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      {variant === 'verified' && (
        <BadgeCheck size={14} className="badge__seal" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
