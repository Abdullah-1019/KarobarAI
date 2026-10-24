import { useState } from 'react';
import { Alert, Button } from 'antd';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, ClipboardList, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { ProductStatus, SellerProductListDTO } from '@karobarai/shared';
import { AiMark, PriceDisplay, ProductThumbnail, SkeletonLoader } from '../../components';
import { OrderStatusTag } from '../orders/OrderStatusTag';
import { listSellerOrders, sellerOrdersQueryKey } from '../orders/ordersApi';
import { PROFILE_QUERY_KEY, getProfile } from '../profile/profileApi';
import { listSellerProducts, sellerProductsQueryKey } from './catalogApi';
import { formatCatalogError } from './catalogErrors';
import { ProductStatusTag } from './ProductStatusTag';

type StatusFilter = ProductStatus | 'ALL';
const FILTERS: StatusFilter[] = ['ALL', 'LIVE', 'DRAFT', 'OUT_OF_STOCK', 'REMOVED'];

// The Seller's landing page (`/seller` — there is no separate dashboard route; SellerLayout's
// comment documents why). Studio Light: a lilac greeting band carrying the store's real counts and
// the one bold moment — the "add with AI" card that leads into the AI Store Builder — then the
// product list (filter pills + image-forward rows) beside recent orders.
//
// Deliberately no revenue metric: RevenueCards documents that revenue reads "Rs. 0" for every
// real seller until a settlement engine exists. Counts reuse existing endpoints only.
// The dashboard counts need the whole catalogue, but /seller/products pages 20 at a time and has
// no count endpoint (BACKEND-NOTES). Walk the pages, capped so a huge store can't loop for ever.
const SUMMARY_PAGE_CAP = 25;
async function listAllSellerProducts(): Promise<SellerProductListDTO> {
  let page = await listSellerProducts(undefined, undefined);
  const items = [...page.items];
  for (let n = 1; page.nextCursor && n < SUMMARY_PAGE_CAP; n++) {
    page = await listSellerProducts(undefined, page.nextCursor);
    items.push(...page.items);
  }
  return { ...page, items };
}

export function SellerProductsPage() {
  const { t } = useTranslation(['catalog', 'common']);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const backendStatus = statusFilter === 'ALL' ? undefined : statusFilter;

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: sellerProductsQueryKey(backendStatus),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listSellerProducts(backendStatus, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  // Distinct query keys (…'summary') on purpose: the same endpoints back infinite queries
  // elsewhere, and React Query caches by key — sharing one would read the infinite cache shape
  // ({pages}) and crash on `.items`. Found in live testing; see git history for details.
  const { data: allProducts } = useQuery({
    queryKey: [...sellerProductsQueryKey(undefined), 'summary'],
    queryFn: listAllSellerProducts,
  });
  const { data: profile } = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: getProfile });
  const { data: recentOrdersPage, isPending: ordersPending } = useQuery({
    queryKey: [...sellerOrdersQueryKey(undefined), 'summary'],
    queryFn: () => listSellerOrders(undefined, undefined),
  });

  const storeName = profile?.role === 'SELLER' ? profile.storeName : undefined;
  const bannerUrl = profile?.role === 'SELLER' ? profile.bannerUrl : null;
  const recentOrders = recentOrdersPage?.items.slice(0, 4) ?? [];
  // There is no count endpoint, so the summary walks every page (listAllSellerProducts).
  const countsComplete = !!allProducts && !allProducts.nextCursor;
  const totalCount = allProducts?.items.length ?? 0;
  const liveCount = allProducts?.items.filter((p) => p.status === 'LIVE').length ?? 0;
  const outOfStockCount = allProducts?.items.filter((p) => p.status === 'OUT_OF_STOCK').length ?? 0;
  // "–" only while loading; a catalogue past the page cap shows "N+" instead of understating.
  const countLabel = (count: number) => (!allProducts ? '–' : countsComplete ? count : `${count}+`);

  // Getting-started tracker, from real data only; hidden once everything is done.
  const setupSteps = [
    { key: 'stepStoreCreated', done: true, to: undefined },
    { key: 'stepFirstProduct', done: countsComplete ? totalCount > 0 : true, to: '/seller/products/new' },
    { key: 'stepFirstOrder', done: !ordersPending && (recentOrdersPage?.items.length ?? 0) > 0, to: undefined },
  ] as const;
  const setupDone = setupSteps.filter((step) => step.done).length;
  const showSetup = countsComplete && !ordersPending && setupDone < setupSteps.length;

  const filterLabel = (filter: StatusFilter) =>
    filter === 'ALL' ? t('catalog:productsList.statusAll') : t(`catalog:status.${filter}`);

  return (
    <div className="slHome">
      <section className="slBand" data-banner={bannerUrl ? true : undefined}>
        {bannerUrl && (
          <span className="slBandBanner" aria-hidden="true">
            <img src={bannerUrl} alt="" />
          </span>
        )}
        <div className="slBandText">
          <h1 className="slGreeting">
            {storeName ? t('catalog:dashboard.greeting', { storeName }) : t('catalog:productsList.title')}
          </h1>
          <p className="slGreetingSub">{t('catalog:dashboard.greetingSub')}</p>

          <dl className="slStats" aria-busy={!countsComplete || undefined}>
            <div className="slStat">
              <dt>{t('catalog:dashboard.totalProducts')}</dt>
              <dd>{countLabel(totalCount)}</dd>
            </div>
            <div className="slStat">
              <dt>{t('catalog:dashboard.liveProducts')}</dt>
              <dd>{countLabel(liveCount)}</dd>
            </div>
            <div className="slStat" data-warn={outOfStockCount > 0 || undefined}>
              <dt>{t('catalog:dashboard.outOfStock')}</dt>
              <dd>{countLabel(outOfStockCount)}</dd>
            </div>
          </dl>
        </div>

        <Link to="/seller/products/new" className="slAiCard">
          <span className="slAiArt" aria-hidden="true">
            <span className="slAiPhoto">
              <img src="/demo/products/fashion-clothing.svg" alt="" />
              <span className="slAiScan" />
            </span>
            <span className="slAiLines">
              <span className="slAiChip">
                <AiMark size={11} color="var(--ai-accent)" />
                AI
              </span>
              <span className="slAiLine" />
              <span className="slAiLine slAiLine--short" />
              <span className="slAiLine slAiLine--ur" />
            </span>
          </span>
          <span className="slAiTitle">{t('catalog:dashboard.aiCtaTitle')}</span>
          <span className="slAiBody">{t('catalog:dashboard.aiCtaBody')}</span>
          <span className="slAiAction">
            <Plus size={16} aria-hidden="true" />
            {t('catalog:dashboard.aiCtaAction')}
          </span>
        </Link>
      </section>

      {showSetup && (
        <section className="slSetup" aria-labelledby="sl-setup-title">
          <div className="slSetupHead">
            <h2 id="sl-setup-title" className="slPanelTitle">
              {t('catalog:dashboard.setupTitle')}
            </h2>
            <span className="slSetupCount">
              {t('catalog:dashboard.setupProgress', { done: setupDone, total: setupSteps.length })}
            </span>
          </div>
          <div className="slSetupBar" aria-hidden="true">
            <span style={{ width: `${(setupDone / setupSteps.length) * 100}%` }} />
          </div>
          <ol className="slSetupSteps">
            {setupSteps.map((step) => {
              const body = (
                <>
                  <span className="slSetupMark" aria-hidden="true">
                    {step.done && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span>{t(`catalog:dashboard.${step.key}`)}</span>
                </>
              );
              return (
                <li key={step.key} className="slSetupStep" data-done={step.done || undefined}>
                  {step.to && !step.done ? (
                    <Link to={step.to} className="slSetupLink">
                      {body}
                    </Link>
                  ) : (
                    <span className="slSetupLink">{body}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="slGrid">
        <section className="slPanel" aria-labelledby="sl-products-title">
          <div className="slPanelHead">
            <h2 id="sl-products-title" className="slPanelTitle">
              {t('catalog:productsList.title')}
            </h2>
            <Link to="/seller/products/new" className="slGhostBtn">
              <Plus size={16} aria-hidden="true" />
              {t('catalog:productsList.addProduct')}
            </Link>
          </div>

          <div className="slFilters" role="group" aria-label={t('catalog:productsList.columnStatus')}>
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className="slFilter"
                aria-pressed={statusFilter === filter}
                onClick={() => setStatusFilter(filter)}
              >
                {filterLabel(filter)}
              </button>
            ))}
          </div>

          {isPending && <SkeletonLoader rows={4} />}

          {isError && <Alert type="error" showIcon message={formatCatalogError(t, error)} />}

          {!isPending && !isError && items.length === 0 && (
            <div className="slEmpty">
              <span className="slEmptyIcon" aria-hidden="true">
                <AiMark size={22} color="var(--brand-ink)" />
              </span>
              <p className="slEmptyTitle">{t('catalog:productsList.empty')}</p>
              <p className="slEmptyBody">{t('catalog:dashboard.productsEmptyBody')}</p>
              <Link to="/seller/products/new" className="slPrimaryBtn">
                <Plus size={16} aria-hidden="true" />
                {t('catalog:dashboard.aiCtaAction')}
              </Link>
            </div>
          )}

          {!isPending && !isError && items.length > 0 && (
            <>
              <ul className="slRows">
                {items.map((product) => (
                  <li key={product.id}>
                    <Link to={`/seller/products/${product.id}/edit`} className="slRow">
                      <span className="slRowThumb">
                        <ProductThumbnail src={product.primaryImageUrl} size={52} />
                      </span>
                      <span className="slRowMain">
                        <span className="slRowTitle">{product.titleEn}</span>
                        <span className="slRowMeta">
                          {t('catalog:productsList.columnStock')}: {product.stock}
                        </span>
                      </span>
                      <span className="slRowPrice">
                        <PriceDisplay amount={product.price} size="sm" />
                      </span>
                      <span className="slRowStatus">
                        <ProductStatusTag status={product.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {hasNextPage && (
                <div className="slMore">
                  <Button shape="round" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                    {t('catalog:productsList.loadMore')}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="slPanel slOrders" aria-labelledby="sl-orders-title">
          <div className="slPanelHead">
            <h2 id="sl-orders-title" className="slPanelTitle">
              {t('catalog:dashboard.recentOrders')}
            </h2>
          </div>

          {ordersPending ? (
            <SkeletonLoader rows={3} />
          ) : recentOrders.length === 0 ? (
            <div className="slEmpty slEmpty--quiet">
              <span className="slEmptyIcon" aria-hidden="true">
                <ClipboardList size={20} />
              </span>
              <p className="slEmptyTitle">{t('catalog:dashboard.noRecentOrders')}</p>
              <p className="slEmptyBody">{t('catalog:dashboard.ordersEmpty')}</p>
            </div>
          ) : (
            <ul className="slOrderList">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link to={`/seller/orders/${order.id}`} className="slOrder">
                    <span className="slAvatar" aria-hidden="true">
                      {order.counterpartyName.trim().slice(0, 1).toUpperCase() || '?'}
                    </span>
                    <span className="slOrderMain">
                      <span className="slOrderName">{order.counterpartyName}</span>
                      <span className="slRowMeta">{new Date(order.placedAt).toLocaleDateString()}</span>
                    </span>
                    <span className="slOrderEnd">
                      <PriceDisplay amount={order.totalAmount} size="sm" />
                      <OrderStatusTag status={order.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="slOrderLinks">
            <Link to="/seller/orders" className="slTextLink">
              {t('catalog:dashboard.viewAllOrders')}
            </Link>
            <Link to="/seller/analytics" className="slTextLink">
              {t('catalog:dashboard.viewAnalytics')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
