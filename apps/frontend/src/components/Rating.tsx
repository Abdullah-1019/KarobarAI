import { Star } from 'lucide-react';

interface RatingProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  showCount?: boolean;
  count?: number;
  ariaLabel?: string;
}

const SIZES = { sm: 14, md: 16 } as const;

export function Rating({ value, max = 5, size = 'sm', showCount, count, ariaLabel }: RatingProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const label = ariaLabel ?? `Rated ${clamped.toFixed(1)} out of ${max}`;
  return (
    <span role="img" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.round(clamped);
        return (
          <Star
            key={i}
            size={SIZES[size]}
            strokeWidth={1.75}
            fill={filled ? 'currentColor' : 'transparent'}
            color="var(--accent-marigold)"
            aria-hidden="true"
          />
        );
      })}
      {showCount && count !== undefined && (
        <span style={{ color: 'var(--text-secondary)', fontSize: size === 'sm' ? 'var(--fs-xs)' : 'var(--fs-sm)' }}>
          ({count})
        </span>
      )}
    </span>
  );
}
