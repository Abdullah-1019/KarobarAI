import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: string;
  className?: string;
  style?: CSSProperties;
}

// Shimmer placeholder for loading states (cards, text lines, media boxes). Uses the shared
// `karobarai-skeleton-shimmer` pulse, which the global reduced-motion rule freezes to a static
// tint — so no separate reduced-motion branch is needed here.
export function Skeleton({ width = '100%', height = 16, radius = 'var(--radius-md)', className, style }: SkeletonProps) {
  const classes = ['skeleton', 'karobarai-skeleton-shimmer', className].filter(Boolean).join(' ');
  return <span className={classes} style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}
