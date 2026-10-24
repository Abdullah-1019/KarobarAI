import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ProductDetailDTO } from '@karobarai/shared';
import { Button } from '../../components';
import { useLanguage } from '../../hooks';
import { ProductGrid } from './ProductGrid';

interface NewArrivalsGridProps {
  products: ProductDetailDTO[];
}

// New arrivals: category pills over a grid that starts with 8 cards and reveals the rest on
// demand. The home feed is a fixed, already-fetched payload (at most 12), so both the filter and
// "Show more" are client-side slices with no extra request. Pills come from the categories
// actually present in the list, and only appear when there are at least two.
const PAGE_SIZE = 8;

export function NewArrivalsGrid({ products }: NewArrivalsGridProps) {
  const { t } = useTranslation(['marketplace']);
  const { language } = useLanguage();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [category, setCategory] = useState<string | null>(null);

  const categories = [...new Map(products.flatMap((p) => (p.category ? [[p.category.slug, p.category] as const] : []))).values()];
  const filtered = category ? products.filter((p) => p.category?.slug === category) : products;
  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  function pick(slug: string | null) {
    setCategory(slug);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <>
      {categories.length > 1 && (
        <div className="na-filter" role="group" aria-label={t('home.filterLabel')}>
          <button type="button" className="sd-chip" aria-pressed={!category} onClick={() => pick(null)}>
            {t('home.filterAll')}
            <span className="na-filter__count">{products.length}</span>
          </button>
          {categories.map((c) => (
            <button key={c.slug} type="button" className="sd-chip" aria-pressed={category === c.slug} onClick={() => pick(c.slug)}>
              {language === 'UR' ? c.nameUr : c.nameEn}
              <span className="na-filter__count">{products.filter((p) => p.category?.slug === c.slug).length}</span>
            </button>
          ))}
        </div>
      )}
      <div className="na-grid" key={category ?? 'all'}>
        <ProductGrid products={visible} />
      </div>
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
