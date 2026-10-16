import type { ReactNode } from 'react';

interface StickyActionBarProps {
  children: ReactNode;
  /** Extra bottom offset (e.g. to clear a mobile bottom tab bar). */
  offsetBottom?: number;
  className?: string;
}

export function StickyActionBar({ children, offsetBottom = 0, className }: StickyActionBarProps) {
  return (
    <div className={['sticky-action-bar', className].filter(Boolean).join(' ')} style={{ bottom: offsetBottom }}>
      {children}
    </div>
  );
}
