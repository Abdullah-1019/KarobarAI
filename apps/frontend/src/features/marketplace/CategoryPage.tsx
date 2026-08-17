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
// hands off to the same search grid text-search uses (categoryId-only call, no q). No outer
// max-width wrapper — AppShell's shared content area (Phase C) already provides one.
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
    return <SkeletonLoader rows={6} />;
  }

  if (isError || !category) {
    return <Alert type="error" showIcon message={formatMarketplaceError(t, error)} />;
  }

  return (
    <div>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-5)' }}>
        {language === 'UR' ? category.nameUr : category.nameEn}
      </Typography.Title>
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
