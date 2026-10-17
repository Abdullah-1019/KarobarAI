import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { Alert } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, EmptyState } from '../../components';
import { BrowseCountSlot } from './browseSlots';
import { ProductGrid } from './ProductGrid';
import { ProductGridSkeleton } from './ProductGridSkeleton';
import { searchProducts, searchQueryKey, type SearchParams } from './marketplaceApi';
import { formatMarketplaceError } from './marketplaceErrors';

interface SearchResultsGridProps {
  params: SearchParams;
  /** Clears the narrowing filters — offered from the empty state. */
  onClear?: () => void;
}

// Shared cursor-paginated grid consumed by both SearchPage (q + filters) and CategoryPage
// (categoryId-only, no q) — mirrors SellerProductsPage.tsx's useInfiniteQuery/load-more pattern.
// The empty state gives direction (try another word, clear a filter) rather than a dead end.
export function SearchResultsGrid({ params, onClear }: SearchResultsGridProps) {
  const { t } = useTranslation(['marketplace']);
  const countSlot = useContext(BrowseCountSlot);

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: searchQueryKey(params),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => searchProducts(params, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  if (isPending) return <ProductGridSkeleton count={9} />;
  if (isError) return <Alert type="error" showIcon message={formatMarketplaceError(t, error)} />;
  if (items.length === 0) {
    return (
      <div className="browse__empty">
        <EmptyState
          icon={<SearchX size={30} strokeWidth={1.5} />}
          title={t('browse.emptyTitle')}
          description={t('browse.emptyBody')}
          actionLabel={onClear ? t('browse.clearAll') : undefined}
          onAction={onClear}
        />
      </div>
    );
  }

  return (
    <>
      {/* The count joins the toolbar row (beside sort) when BrowseLayout provides a slot. */}
      {countSlot ? (
        createPortal(<p className="browse__count">{t('browse.showing', { count: items.length })}</p>, countSlot)
      ) : (
        <p className="browse__count">{t('browse.showing', { count: items.length })}</p>
      )}
      <ProductGrid products={items} />
      {hasNextPage && (
        <div className="browse__more">
          <Button variant="outline" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
            {t('search.loadMore')}
          </Button>
        </div>
      )}
    </>
  );
}
