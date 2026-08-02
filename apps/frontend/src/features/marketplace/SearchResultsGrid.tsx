import { Alert, Button, Empty, Typography } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SkeletonLoader } from '../../components';
import { ProductCard } from './ProductCard';
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

  if (isPending) return <SkeletonLoader rows={6} />;
  if (isError) return <Alert type="error" showIcon message={formatMarketplaceError(t, error)} />;
  if (items.length === 0) return <Empty description={t('search.empty')} />;

  return (
    <>
      <Typography.Text type="secondary">{t('search.resultsCount', { count: items.length })}</Typography.Text>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
          marginTop: 12,
        }}
      >
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {hasNextPage && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
            {t('search.loadMore')}
          </Button>
        </div>
      )}
    </>
  );
}
