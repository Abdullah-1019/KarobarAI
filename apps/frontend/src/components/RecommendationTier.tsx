import { Typography } from 'antd';

interface RecommendationTierProps {
  label: string;
  /** 1 = strongest tier (most bars filled) through 3 = weakest. */
  level: 1 | 2 | 3;
}

// E5 "Enhanced Visual Execution" — when a backend does supply a raw score, present it as a
// plain-language tier backed by a simple bar, never the decimal itself as the headline (a number
// may still appear as secondary/supporting detail elsewhere on the card). Reusable anywhere a
// recommendation needs a human-readable read instead of a model score.
export function RecommendationTier({ label, level }: RecommendationTierProps) {
  const filled = 4 - level;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
      <div aria-hidden="true" style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 14,
              height: 4,
              borderRadius: 'var(--radius-pill)',
              background: i <= filled ? 'var(--brand-primary)' : 'var(--border)',
            }}
          />
        ))}
      </div>
      <Typography.Text strong>{label}</Typography.Text>
    </div>
  );
}
