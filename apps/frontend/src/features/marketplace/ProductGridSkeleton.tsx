import type { CSSProperties } from 'react';

import { ProductCardSkeleton } from '../../components';

interface ProductGridSkeletonProps {
  count?: number;
  /** 'product' matches ProductGrid/ProductCard's shape; 'category' matches CategoryGrid's tiles. */
  variant?: 'product' | 'category';
  style?: CSSProperties;
}

// UIUX §20: loading skeletons (shape-matched to final content) — previously the shared generic
// SkeletonLoader, which read as unrelated to the grid it stood in for. Feature-scoped since its
// shape is coupled to ProductCard/CategoryGrid, both marketplace-owned.
//
// Phase 6: the product branch now mirrors the redesigned card (4:5 photo, two text lines) and
// reuses the same `.product-grid` column rhythm as the real grid, so the skeleton and the content
// can't drift apart.
export function ProductGridSkeleton({ count = 6, variant = 'product', style }: ProductGridSkeletonProps) {
  if (variant === 'category') {
    return (
      <div aria-hidden="true" className="cat-grid" style={style}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="cat-tile cat-tile--skeleton">
            <span className="cat-tile__icon karobarai-skeleton-shimmer" />
            <span className="cat-tile__body">
              <span
                className="karobarai-skeleton-shimmer"
                style={{ height: 14, width: '70%', borderRadius: 'var(--radius-sm)', background: 'var(--bg-sunken)' }}
              />
              <span
                className="karobarai-skeleton-shimmer"
                style={{ height: 12, width: '45%', marginTop: 'var(--sp-1)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-sunken)' }}
              />
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Delegates each cell to the shared ProductCardSkeleton (Phase 1, Batch-1) so the loading shape
  // and the real card can never drift apart — there is exactly one card skeleton in the codebase.
  return (
    <div aria-hidden="true" className="product-grid" style={style}>
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
