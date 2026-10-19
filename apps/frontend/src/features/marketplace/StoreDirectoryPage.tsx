import { useState } from 'react';
import { Alert, Input, Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { CategoryDTO } from '@karobarai/shared';
import { Breadcrumb, EmptyState, Skeleton } from '../../components';
import { useLanguage } from '../../hooks';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import { StoreMonogram } from './StoreMonogram';
import { getStoreDirectory } from './storeApi';

function flattenCategories(categories: CategoryDTO[]): CategoryDTO[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

export function StoreDirectoryPage() {
  const { t } = useTranslation(['marketplace', 'common']);
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState<string | undefined>();
  const [sort, setSort] = useState<'name' | 'newest' | 'most_products'>('name');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['stores', 'directory', search.trim(), categorySlug, sort, page],
    queryFn: () => getStoreDirectory({ q: search.trim() || undefined, categorySlug, sort, page }),
  });
  const categories = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });
  const categoryOptions = flattenCategories(categories.data ?? []).map((category) => ({
    value: category.slug,
    label: language === 'UR' ? category.nameUr : category.nameEn,
  }));

  return (
    <main className="store-directory">
      <Breadcrumb items={[{ label: t('common:nav.home'), to: '/' }, { label: t('directory.title') }]} />
      <h1>{t('directory.title')}</h1>
      <p className="store-directory__intro">{t('directory.intro')}</p>
      <div className="store-directory__filters">
        <Input.Search
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder={t('directory.search')}
          aria-label={t('directory.search')}
          allowClear
          maxLength={120}
        />
        <Select
          value={categorySlug}
          onChange={(value: string | undefined) => { setCategorySlug(value); setPage(1); }}
          options={categoryOptions}
          placeholder={t('directory.allCategories')}
          aria-label={t('directory.category')}
          allowClear
          showSearch
          optionFilterProp="label"
        />
        <Select
          value={sort}
          onChange={(value: 'name' | 'newest' | 'most_products') => { setSort(value); setPage(1); }}
          options={[{ value: 'name', label: t('directory.sortName') }, { value: 'newest', label: t('directory.sortNewest') }, { value: 'most_products', label: t('directory.sortMostProducts') }]}
          aria-label={t('directory.sort')}
        />
      </div>
      {query.isPending && (
        <div className="store-directory__grid" aria-busy="true" aria-label={t('directory.loading')}>
          {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} height={180} radius="var(--card-radius)" />)}
        </div>
      )}
      {query.isError && <Alert type="error" showIcon message={t('directory.error')} action={<button type="button" onClick={() => query.refetch()}>{t('common:actions.retry')}</button>} />}
      {query.data && (
        <>
          {query.data.items.length === 0 ? <EmptyState title={t('directory.empty')} /> : (
            <div className="store-directory__grid">
              {query.data.items.map((store) => (
                <Link key={store.slug} to={`/store/${encodeURIComponent(store.slug)}`} className="store-directory__card">
                  <StoreMonogram name={store.name} logoUrl={store.logoUrl} />
                  <strong dir="auto">{store.name}</strong>
                  {store.category && <span>{language === 'UR' ? store.category.nameUr : store.category.nameEn}</span>}
                  {store.city && <span dir="auto">{store.city}</span>}
                  {(language === 'UR' ? store.descriptionUr ?? store.description : store.description ?? store.descriptionUr) && (
                    <p dir="auto">{language === 'UR' ? store.descriptionUr ?? store.description : store.description ?? store.descriptionUr}</p>
                  )}
                  <span>{t('store.products', { count: store.productCount })}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="store-directory__pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>{t('directory.previous')}</button>
            <span>{t('directory.page', { page })}</span>
            <button type="button" disabled={!query.data.hasMore} onClick={() => setPage((current) => current + 1)}>{t('directory.next')}</button>
          </div>
        </>
      )}
    </main>
  );
}
