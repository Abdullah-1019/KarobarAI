import type { CSSProperties } from 'react';

interface ProductGridSkeletonProps {
  count?: number;
  /** 'product' matches ProductGrid/ProductCard's shape; 'category' matches CategoryGrid's tiles. */
  variant?: 'product' | 'category';
  style?: CSSProperties;
}

const GRID_MINMAX: Record<'product' | 'category', string> = {
  product: '180px',
  category: '140px',
};

// UIUX §20: loading skeletons must be "shape-matched to final content" — HomePage/SearchResults/
// CategoryPage previously fell back to the generic `SkeletonLoader` (a handful of flat AntD
// paragraph bars), which doesn't resemble a product grid at all and was the loading-state half of
// the Marketplace's "feels generic" problem. Feature-scoped (not components/) since its grid
// template mirrors ProductGrid/CategoryGrid exactly and would drift the moment either changes.
export function ProductGridSkeleton({ count = 6, variant = 'product', style }: ProductGridSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MINMAX[variant]}, 1fr))`,
        gap: variant === 'category' ? 'var(--sp-3)' : 'var(--sp-4)',
        ...style,
      }}
    >
      {Array.from({ length: count }).map((_, index) =>
        variant === 'category' ? (
          <div
            key={index}
            className="karobarai-skeleton-shimmer"
            style={{ height: 64, borderRadius: 'var(--radius-md)', background: 'var(--bg-sunken)' }}
          />
        ) : (
          <div
            key={index}
            style={{
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="karobarai-skeleton-shimmer" style={{ aspectRatio: '1 / 1', background: 'var(--bg-sunken)' }} />
            <div style={{ padding: 'var(--sp-3)' }}>
              <div
                className="karobarai-skeleton-shimmer"
                style={{ height: 14, width: '85%', borderRadius: 'var(--radius-sm)', background: 'var(--bg-sunken)' }}
              />
              <div
                className="karobarai-skeleton-shimmer"
                style={{ height: 14, width: '40%', marginTop: 'var(--sp-2)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-sunken)' }}
              />
            </div>
          </div>
        ),
      )}
    </div>
  );
}
