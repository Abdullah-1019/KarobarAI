import { useState } from 'react';
import { Alert, Col, Row, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { SkeletonLoader } from '../../components';
import { useLanguage } from '../../hooks';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import { FilterPanel } from './FilterPanel';
import { SearchResultsGrid } from './SearchResultsGrid';
import { categoryBySlugQueryKey, getCategoryBySlug, type SearchParams } from './marketplaceApi';
import { formatMarketplaceError } from './marketplaceErrors';

// SCR-B02's category-browse mode (`/category/:slug`) — resolves the slug to a categoryId, then
// hands off to the same search grid text-search uses (categoryId-only call, no q).
export function CategoryPage() {
  const { t } = useTranslation(['marketplace']);
  const { language } = useLanguage();
  const { slug = '' } = useParams<{ slug: string }>();
  const [filters, setFilters] = useState<Omit<SearchParams, 'q' | 'categoryId'>>({});

  const { data: category, isPending, isError, error } = useQuery({
    queryKey: categoryBySlugQueryKey(slug),
    queryFn: () => getCategoryBySlug(slug),
    enabled: !!slug,
  });
  const { data: categories } = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });

  if (isPending) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !category) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="error" showIcon message={formatMarketplaceError(t, error)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{language === 'UR' ? category.nameUr : category.nameEn}</Typography.Title>
      <Row gutter={24}>
        <Col xs={24} md={6}>
          <FilterPanel
            categories={categories ?? []}
            value={filters}
            onChange={setFilters}
            onReset={() => setFilters({})}
            showCategory={false}
          />
        </Col>
        <Col xs={24} md={18}>
          <SearchResultsGrid params={{ categoryId: category.id, ...filters }} />
        </Col>
      </Row>
    </div>
  );
}
