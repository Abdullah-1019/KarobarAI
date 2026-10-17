interface AiMarkProps {
  size?: number;
  /** Defaults to brass. Pass `currentColor` to inherit from the surrounding text. */
  color?: string;
  className?: string;
}

// KarobarAI's AI mark — the eight-point block-print star from the brand pattern, drawn as a
// "compass" star: four long points (the diamond) over four short ones, with sharp tips so it
// reads as a spark at 12–16px and never as a gear. It replaces the generic sparkle icon everywhere
// the UI signals "AI did this". Decorative: always pair it with a text label.
export function AiMark({ size = 16, color = 'var(--accent-marigold)', className }: AiMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      <g fill={color}>
        {/* Long points: N / E / S / W. */}
        <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
        {/* Short points on the diagonals. */}
        <path d="M12 6.2l1.7 4.1 4.1 1.7-4.1 1.7-1.7 4.1-1.7-4.1-4.1-1.7 4.1-1.7z" transform="rotate(45 12 12)" />
      </g>
    </svg>
  );
}
