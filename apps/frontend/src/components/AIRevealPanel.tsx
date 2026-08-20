import { Children, type ReactNode } from 'react';

interface AIRevealPanelProps {
  /** Bump this (e.g. a counter incremented on each successful generation) to replay the entrance
   * animation — React only re-runs a CSS entrance animation when the element is freshly mounted,
   * so this is passed straight through as the wrapper's `key`. */
  revealKey: number | string;
  /** E5 — set for a regeneration (re-running AI on a screen that already showed a result, e.g.
   * EditProductPage's "Generate with AI") so it plays as a quick refresh (--dur-fast, tighter
   * stagger) rather than replaying the full first-time reveal (--dur-slow, AddProductPage). */
  fast?: boolean;
  children: ReactNode;
}

// UIUX §33 names this component explicitly ("AIRevealPanel") and §22 describes the moment it
// exists for: "fields animate in as a paired EN ⇄ اردو reveal... the brand fingerprint." Each
// direct child gets a short, staggered fade+rise (existing easing token) rather than popping in
// all at once — purposeful, not decorative, and stripped to an instant appearance under
// prefers-reduced-motion via the centralized rule from Phase B.
export function AIRevealPanel({ revealKey, fast = false, children }: AIRevealPanelProps) {
  return (
    <div key={revealKey}>
      {Children.map(children, (child, index) => (
        <div
          className={fast ? 'karobarai-ai-reveal-fast' : 'karobarai-ai-reveal'}
          style={{ animationDelay: `${index * (fast ? 30 : 60)}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
