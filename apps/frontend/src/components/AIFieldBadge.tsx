interface AIFieldBadgeProps {
  show: boolean;
  label: string;
}

// E5 "Enhanced Visual Execution" — a per-field marker that a specific field is still exactly as
// AI generated it, quieter than AIHint's once-per-screen badge (a small marigold dot, not another
// "AI" text label — the brief explicitly warns against decorating every field with the word "AI").
// Parent passes show={!dirtyFields.fieldName}; it disappears the instant the seller edits that
// field, so at a glance they can see what they've personally reviewed vs what's still untouched.
export function AIFieldBadge({ show, label }: AIFieldBadgeProps) {
  if (!show) return null;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--accent-marigold)',
        marginInlineStart: 'var(--sp-2)',
        verticalAlign: 'middle',
      }}
    />
  );
}
