import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import type { ProductCondition } from '@karobarai/shared';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import { BrowseLayout } from './BrowseLayout';
import type { BrowseFilters } from './FilterPanel';
import { SearchResultsGrid } from './SearchResultsGrid';
import type { SortOption } from './marketplaceApi';

// SCR-B02 — text-search entry point (`/search?q=`) and "all products". Filters live in the URL so
// results are shareable/bookmarkable and survive a reload. Layout, chips, sort and the mobile
// filter sheet come from BrowseLayout (shared with CategoryPage).
export function SearchPage() {
  const { t } = useTranslation('marketplace');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories } = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });

  const q = searchParams.get('q') ?? undefined;
  const filters: BrowseFilters = {
    categoryId: searchParams.get('categoryId') ?? undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    condition: (searchParams.get('condition') as ProductCondition | null) ?? undefined,
    sort: (searchParams.get('sort') as SortOption | null) ?? undefined,
  };

  function updateFilters(next: BrowseFilters) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (next.categoryId) params.set('categoryId', next.categoryId);
    if (next.minPrice !== undefined) params.set('minPrice', String(next.minPrice));
    if (next.maxPrice !== undefined) params.set('maxPrice', String(next.maxPrice));
    if (next.condition) params.set('condition', next.condition);
    if (next.sort) params.set('sort', next.sort);
    setSearchParams(params);
  }

  function clearFilters() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (filters.sort) params.set('sort', filters.sort);
    setSearchParams(params);
  }

  return (
    <BrowseLayout
      header={
        <header className="browse-head">
          <h1 className="browse-head__title">{q ? t('browse.resultsFor', { q }) : t('browse.allProducts')}</h1>
        </header>
      }
      categories={categories ?? []}
      filters={filters}
      onChange={updateFilters}
      onClear={clearFilters}
    >
      <SearchResultsGrid params={{ q, ...filters }} onClear={clearFilters} />
    </BrowseLayout>
  );
}
