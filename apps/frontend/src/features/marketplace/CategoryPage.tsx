import { useState } from 'react';
import { Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { Breadcrumb, Skeleton } from '../../components';
import { useLanguage } from '../../hooks';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import { BrowseLayout } from './BrowseLayout';
import { CATEGORY_ART, ruleFor } from './categoryVisuals';
import type { BrowseFilters } from './FilterPanel';
import { SearchResultsGrid } from './SearchResultsGrid';
import { categoryBySlugQueryKey, getCategoryBySlug } from './marketplaceApi';
import { formatMarketplaceError } from './marketplaceErrors';

// SCR-B02's category-browse mode (`/category/:slug`) — resolves the slug to a categoryId, then
// hands off to the same results grid text-search uses. Opens with a tonal banner carrying the
// category's illustration (or icon), both language names and a breadcrumb, then the shared
// BrowseLayout (the category filter is hidden — the page already is one).
export function CategoryPage() {
  const { t } = useTranslation(['marketplace', 'common']);
  const { language } = useLanguage();
  const { slug = '' } = useParams<{ slug: string }>();
  const [filters, setFilters] = useState<BrowseFilters>({});

  const { data: category, isPending, isError, error } = useQuery({
    queryKey: categoryBySlugQueryKey(slug),
    queryFn: () => getCategoryBySlug(slug),
    enabled: !!slug,
  });
  const { data: categories } = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });

  if (isPending) {
    return <Skeleton height={180} radius="var(--radius-xl)" />;
  }

  if (isError || !category) {
    return <Alert type="error" showIcon message={formatMarketplaceError(t, error)} />;
  }

  const name = (language === 'UR' ? category.nameUr : category.nameEn) || category.slug;
  const otherName = language === 'UR' ? category.nameEn : category.nameUr;
  const { key, icon: Icon } = ruleFor(category.slug);
  const art = CATEGORY_ART[key];

  return (
    <BrowseLayout
      header={
        <header className={`cat-banner cat-tile--${key}`}>
          <div className="cat-banner__copy">
            <Breadcrumb items={[{ label: t('common:nav.home'), to: '/' }, { label: name }]} />
            <h1 className="cat-banner__title">{name}</h1>
            {otherName && otherName !== name && <p className="cat-banner__other">{otherName}</p>}
            <p className="cat-banner__blurb">{t('browse.categoryBlurb')}</p>
          </div>
          <div className="cat-banner__art" aria-hidden="true">
            {art ? <img src={art} alt="" width={400} height={500} /> : <Icon size={56} strokeWidth={1.5} />}
          </div>
        </header>
      }
      categories={categories ?? []}
      filters={filters}
      onChange={setFilters}
      onClear={() => setFilters((current) => ({ sort: current.sort }))}
      showCategory={false}
    >
      <SearchResultsGrid params={{ categoryId: category.id, ...filters }} onClear={() => setFilters((current) => ({ sort: current.sort }))} />
    </BrowseLayout>
  );
}
