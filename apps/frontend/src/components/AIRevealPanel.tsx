import { Children, type ReactNode } from 'react';

interface AIRevealPanelProps {
  /** Bump this (e.g. a counter incremented on each successful generation) to replay the entrance
   * animation — React only re-runs a CSS entrance animation when the element is freshly mounted,
   * so this is passed straight through as the wrapper's `key`. */
  revealKey: number | string;
  children: ReactNode;
}

// UIUX §33 names this component explicitly ("AIRevealPanel") and §22 describes the moment it
// exists for: "fields animate in as a paired EN ⇄ اردو reveal... the brand fingerprint." Each
// direct child gets a short, staggered fade+rise (--dur-slow, existing easing token) rather than
// popping in all at once — purposeful, not decorative, and stripped to an instant appearance
// under prefers-reduced-motion via the centralized rule from Phase B.
export function AIRevealPanel({ revealKey, children }: AIRevealPanelProps) {
  return (
    <div key={revealKey}>
      {Children.map(children, (child, index) => (
        <div className="karobarai-ai-reveal" style={{ animationDelay: `${index * 60}ms` }}>
          {child}
        </div>
      ))}
    </div>
  );
}
