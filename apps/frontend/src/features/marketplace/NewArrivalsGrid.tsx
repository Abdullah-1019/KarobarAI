import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ProductDetailDTO } from '@karobarai/shared';
import { Button } from '../../components';
import { ProductGrid } from './ProductGrid';

interface NewArrivalsGridProps {
  products: ProductDetailDTO[];
}

// New arrivals (Phase 6): a grid that starts with 8 cards and reveals the rest on demand. The whole
// page is a fixed, already-fetched payload (the home feed carries at most 12), so "load more" is a
// slice change rather than a second network request — which is also why there's no loading spinner
// here. When the feed can return a longer tail this becomes a real paginated query.
const PAGE_SIZE = 8;

export function NewArrivalsGrid({ products }: NewArrivalsGridProps) {
  const { t } = useTranslation(['marketplace']);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = products.slice(0, visibleCount);
  const hasMore = products.length > visibleCount;

  return (
    <>
      <ProductGrid products={visible} />
      {hasMore && (
        <div className="new-arrivals__more">
          <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            {t('home.loadMore')}
          </Button>
        </div>
      )}
    </>
  );
}
