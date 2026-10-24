import { useState } from 'react';
import { Alert, Input, Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Search, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Breadcrumb, EmptyState, Skeleton } from '../../components';
import { useLanguage } from '../../hooks';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import { StoreCard } from './StoreCard';
import { getStoreDirectory } from './storeApi';

const PAGE_SIZE = 12;

// All stores (/stores), Studio Light. A soft peach hero with the live store count, a white
// toolbar (search pill, category pills, sort), then the shared rich StoreCard grid.
export function StoreDirectoryPage() {
  const { t } = useTranslation(['marketplace', 'common']);
  const { language, dir } = useLanguage();
  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState<string | undefined>();
  const [sort, setSort] = useState<'name' | 'newest' | 'most_products'>('name');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['stores', 'directory', search.trim(), categorySlug, sort, page],
    queryFn: () => getStoreDirectory({ q: search.trim() || undefined, categorySlug, sort, page, limit: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });
  const categories = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });
  const topCategories = categories.data ?? [];
  const isUr = language === 'UR';
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (query.data?.limit ?? PAGE_SIZE)));
  const filtered = !!search.trim() || !!categorySlug;
  const PrevIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const NextIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const pickCategory = (slug: string | undefined) => {
    setCategorySlug(slug);
    setPage(1);
  };

  return (
    <div className="sd">
      <Breadcrumb items={[{ label: t('common:nav.home'), to: '/' }, { label: t('directory.title') }]} />

      <header className="sd-hero">
        <span className="sd-hero__eyebrow">
          <Store size={14} aria-hidden="true" />
          {t('directory.eyebrow')}
        </span>
        <h1 className="sd-hero__title">{t('directory.heroTitle')}</h1>
        <p className="sd-hero__body">{t('directory.heroBody')}</p>
        {query.data && !filtered && <span className="sd-hero__count">{t('directory.storesCount', { count: total })}</span>}
      </header>

      <section className="sd-toolbar" aria-label={t('directory.search')}>
        <div className="sd-toolbar__row">
          <Input
            className="sd-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            prefix={<Search size={18} aria-hidden="true" />}
            placeholder={t('directory.search')}
            aria-label={t('directory.search')}
            allowClear
            maxLength={120}
          />
          <Select
            className="sd-sort"
            value={sort}
            onChange={(value: 'name' | 'newest' | 'most_products') => {
              setSort(value);
              setPage(1);
            }}
            options={[
              { value: 'name', label: t('directory.sortName') },
              { value: 'newest', label: t('directory.sortNewest') },
              { value: 'most_products', label: t('directory.sortMostProducts') },
            ]}
            aria-label={t('directory.sort')}
          />
        </div>
        {topCategories.length > 0 && (
          <div className="sd-chips" role="group" aria-label={t('directory.category')}>
            <button type="button" className="sd-chip" aria-pressed={!categorySlug} onClick={() => pickCategory(undefined)}>
              {t('directory.allCategories')}
            </button>
            {topCategories.map((category) => (
              <button
                key={category.slug}
                type="button"
                className="sd-chip"
                aria-pressed={categorySlug === category.slug}
                onClick={() => pickCategory(category.slug)}
              >
                {isUr ? category.nameUr : category.nameEn}
              </button>
            ))}
          </div>
        )}
      </section>

      {query.isPending && (
        <div className="sd-grid" aria-busy="true" aria-label={t('directory.loading')}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height={360} radius="28px" />
          ))}
        </div>
      )}

      {query.isError && (
        <Alert
          type="error"
          showIcon
          message={t('directory.error')}
          action={
            <button type="button" className="sd-page-btn" onClick={() => query.refetch()}>
              {t('common:actions.retry')}
            </button>
          }
        />
      )}

      {query.data && (
        <>
          {filtered && <p className="sd-result-count">{t('directory.storesCount', { count: total })}</p>}
          {query.data.items.length === 0 ? (
            <EmptyState
              title={t('directory.empty')}
              actionLabel={filtered ? t('directory.clearFilters') : undefined}
              onAction={
                filtered
                  ? () => {
                      setSearch('');
                      pickCategory(undefined);
                    }
                  : undefined
              }
            />
          ) : (
            <ul className="sd-grid" data-stale={query.isPlaceholderData || undefined}>
              {query.data.items.map((store, index) => (
                <li key={store.slug} style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
                  <StoreCard store={store} isUr={isUr} />
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav className="sd-pages" aria-label={t('directory.pageOf', { page, pages })}>
              <button type="button" className="sd-page-btn" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                <PrevIcon size={16} aria-hidden="true" />
                {t('directory.previous')}
              </button>
              <span className="sd-pages__label">{t('directory.pageOf', { page, pages })}</span>
              <button
                type="button"
                className="sd-page-btn"
                disabled={!query.data.hasMore}
                onClick={() => setPage((current) => current + 1)}
              >
                {t('directory.next')}
                <NextIcon size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
