import { Col, Row, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import type { ProductCondition } from '@karobarai/shared';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import { FilterPanel } from './FilterPanel';
import { SearchResultsGrid } from './SearchResultsGrid';
import type { SearchParams, SortOption } from './marketplaceApi';

// SCR-B02 — text-search entry point (`/search?q=`). Filters live in the URL so results are
// shareable/bookmarkable and survive a reload.
export function SearchPage() {
  const { t } = useTranslation('marketplace');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: categories } = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });

  const q = searchParams.get('q') ?? undefined;
  const filters: Omit<SearchParams, 'q'> = {
    categoryId: searchParams.get('categoryId') ?? undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    condition: (searchParams.get('condition') as ProductCondition | null) ?? undefined,
    sort: (searchParams.get('sort') as SortOption | null) ?? undefined,
  };

  function updateFilters(next: Omit<SearchParams, 'q'>) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (next.categoryId) params.set('categoryId', next.categoryId);
    if (next.minPrice !== undefined) params.set('minPrice', String(next.minPrice));
    if (next.maxPrice !== undefined) params.set('maxPrice', String(next.maxPrice));
    if (next.condition) params.set('condition', next.condition);
    if (next.sort) params.set('sort', next.sort);
    setSearchParams(params);
  }

  function resetFilters() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    setSearchParams(params);
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{q ? `${t('search.title')}: ${q}` : t('search.title')}</Typography.Title>
      <Row gutter={24}>
        <Col xs={24} md={6}>
          <FilterPanel categories={categories ?? []} value={filters} onChange={updateFilters} onReset={resetFilters} />
        </Col>
        <Col xs={24} md={18}>
          <SearchResultsGrid params={{ q, ...filters }} />
        </Col>
      </Row>
    </div>
  );
}
