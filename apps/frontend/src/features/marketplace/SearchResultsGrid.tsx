import { Alert, Button, Typography } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../components';
import { ProductGrid } from './ProductGrid';
import { ProductGridSkeleton } from './ProductGridSkeleton';
import { searchProducts, searchQueryKey, type SearchParams } from './marketplaceApi';
import { formatMarketplaceError } from './marketplaceErrors';

interface SearchResultsGridProps {
  params: SearchParams;
}

// Shared cursor-paginated grid consumed by both SearchPage (q + filters) and CategoryPage
// (categoryId-only, no q) — mirrors SellerProductsPage.tsx's useInfiniteQuery/load-more pattern.
export function SearchResultsGrid({ params }: SearchResultsGridProps) {
  const { t } = useTranslation(['marketplace']);

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: searchQueryKey(params),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => searchProducts(params, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  if (isPending) return <ProductGridSkeleton count={8} />;
  if (isError) return <Alert type="error" showIcon message={formatMarketplaceError(t, error)} />;
  if (items.length === 0) return <EmptyState title={t('search.empty')} />;

  return (
    <>
      <Typography.Text type="secondary">{t('search.resultsCount', { count: items.length })}</Typography.Text>
      <div style={{ marginTop: 'var(--sp-3)' }}>
        <ProductGrid products={items} />
      </div>
      {hasNextPage && (
        <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
          <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
            {t('search.loadMore')}
          </Button>
        </div>
      )}
    </>
  );
}
