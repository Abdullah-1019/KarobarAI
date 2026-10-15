import type { ReactNode } from 'react';

type BadgeVariant = 'new' | 'sale' | 'cod' | 'verified' | 'low-stock' | 'out-of-stock';

interface BadgeProps {
  /** new = saffron NEW; sale = terracotta discount; cod = mint COD pill; verified = tick + label. */
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

// Small status pill for product cards (NEW / -X% / COD / Verified seller / low-stock). Colour
// comes from the `.badge--*` classes; variants are constrained by the union so a typo can't
// reach the stylesheet.
export function Badge({ variant, children, className }: BadgeProps) {
  const classes = ['badge', `badge--${variant}`, className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
