interface CountBadgeProps {
  /** How many unread items. 0 or undefined renders nothing (unless `dot`). */
  count?: number;
  /** Show a plain dot when there is something new but no count to give. */
  dot?: boolean;
  className?: string;
}

// The small persimmon "something new" marker for nav icons (messages, AI assistant, notifications).
// Decorative: the icon's own aria-label carries the count (see `unreadLabel` in common nav).
// The parent must be `position: relative`; the badge sits on its top inline-end corner.
export function CountBadge({ count = 0, dot = false, className }: CountBadgeProps) {
  if (count <= 0 && !dot) return null;
  const classes = ['count-badge', count <= 0 && 'count-badge--dot', className].filter(Boolean).join(' ');
  return (
    <span className={classes} aria-hidden="true">
      {count > 0 ? (count > 9 ? '9+' : count) : null}
    </span>
  );
}
