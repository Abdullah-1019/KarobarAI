import type { CSSProperties, ReactNode } from 'react';

interface SelectableOptionCardProps {
  selected: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

// Checkout's address list and payment-method list were both plain AntD <Radio> rows with no
// visual weight — easy to skim past, no sense of "this is the option I've committed to." Wraps
// each <Radio> (kept as the real, already-accessible input — this only adds a visual shell) in a
// bordered card that highlights on selection, the same "selectable option card" pattern named in
// the E3 brief (Address card / Payment method selector) — one shared shell for both rather than
// two independent implementations, since the pattern is identical.
export function SelectableOptionCard({ selected, children, style }: SelectableOptionCardProps) {
  return (
    <div
      style={{
        padding: 'var(--sp-3) var(--sp-4)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border)'}`,
        background: selected ? 'var(--brand-primary-soft)' : 'var(--bg-surface)',
        transition: 'border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
