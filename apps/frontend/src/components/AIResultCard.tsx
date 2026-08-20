import type { CSSProperties, ReactNode } from 'react';

interface AIResultCardProps {
  children: ReactNode;
  style?: CSSProperties;
}

// E5 "Enhanced Visual Execution" — the primary AI-generated result on a screen (a generated
// product listing, the top-recommended courier) sits at a visibly higher elevation than
// surrounding cards: the existing shadow-lg token plus a thin marigold inline-start accent — the
// one place per screen marigold is structural rather than a badge. No glow, no gradient; reuses
// tokens that already exist elsewhere in the app.
export function AIResultCard({ children, style }: AIResultCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        borderInlineStart: '2px solid var(--accent-marigold)',
        padding: 'var(--sp-5)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
