import { Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { ArrowIcon, Button, EmptyState, Section, Skeleton } from '../../components';
import { useLanguage } from '../../hooks';
import { Hero } from './Hero';
import { TrustStrip } from './TrustStrip';
import { ProductGridSkeleton } from './ProductGridSkeleton';
import { CategoryGrid } from './CategoryGrid';
import { FeaturedProducts } from './FeaturedProducts';
import { NewArrivalsGrid } from './NewArrivalsGrid';
import { AiBanner } from './AiBanner';
import { HOME_FEED_QUERY_KEY, getHomeFeed } from './marketplaceApi';
import { formatMarketplaceError } from './marketplaceErrors';
import { StoreMonogram } from './StoreMonogram';
import { getFeaturedStores } from './storeApi';

// SCR-B01 — entry + discovery. Identical content for Guest and authenticated Buyer (no
// personalization in MVP scope, per F5-marketplace-backend.md's Known limitations). No outer
// max-width/padding wrapper — AppShell's shared content area (Phase C) already provides both, so
// this page uses the full width it's given rather than a second, narrower, redundant container.
//
// The hero + trust strip are static (no data dependency) so they render immediately and own the
// page's single `<h1>`; the data-driven sections below follow the query's pending/error/success
// states.
//
// One query drives every section: /marketplace/home already returns featured + newArrivals +
// categories in a single payload, so there are no per-section hooks to write — they'd re-declare
// the same queryKey and fetch the same endpoint a second and third time.
export function HomePage() {
  const { t } = useTranslation(['marketplace', 'common']);
  const navigate = useNavigate();
  const { language } = useLanguage();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: HOME_FEED_QUERY_KEY,
    queryFn: getHomeFeed,
  });
  const stores = useQuery({ queryKey: ['stores', 'featured'], queryFn: getFeaturedStores });

  const hasProducts = !!data && (data.featured.length > 0 || data.newArrivals.length > 0);
  // New arrivals skip what Featured already shows, so the page never repeats a row — unless that
  // would leave fewer than four, in which case the full list is the more useful page.
  const featuredIds = new Set(data?.featured.map((p) => p.id));
  const freshArrivals = data?.newArrivals.filter((p) => !featuredIds.has(p.id)) ?? [];
  const newArrivals = freshArrivals.length >= 4 ? freshArrivals : (data?.newArrivals ?? []);

  return (
    <div>
      <Hero categories={data?.categories} products={data ? [...data.featured, ...data.newArrivals] : undefined} />
      <TrustStrip />

      <Section title={t('directory.homeTitle')} action={<Link to="/stores" className="section-action-link">{t('directory.viewAll')}<ArrowIcon size={16} /></Link>}>
        {stores.isPending && (
          <div className="store-directory__grid" aria-busy="true" aria-label={t('directory.loading')}>
            {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} height={180} radius="var(--card-radius)" />)}
          </div>
        )}
        {stores.isError && (
          <Alert type="error" showIcon message={t('directory.error')}
            action={<Button variant="outline" onClick={() => stores.refetch()}>{t('common:actions.retry')}</Button>} />
        )}
        {stores.data?.length === 0 && <EmptyState title={t('directory.emptyHome')} />}
        {stores.data && stores.data.length > 0 && (
          <div className="store-directory__grid">
            {stores.data.map((store) => (
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
      </Section>

      {isPending && (
        <>
          <ProductGridSkeleton count={8} variant="category" />
          <ProductGridSkeleton count={4} style={{ marginTop: 'var(--sp-8)' }} />
        </>
      )}

      {isError && (
        <Alert
          type="error"
          showIcon
          message={formatMarketplaceError(t, error)}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              {t('common:actions.retry')}
            </Button>
          }
        />
      )}

      {data && (
        <>
          {data.categories.length > 0 && (
            <Section
              id="categories"
              title={t('home.browseCategories')}
              subtitle={t('home.categoriesSub')}
              action={
                <Link to="/search" className="section-action-link">
                  {t('home.allCategories')}
                  <ArrowIcon size={16} />
                </Link>
              }
            >
              <CategoryGrid categories={data.categories} />
            </Section>
          )}

          {hasProducts ? (
            <>
              {data.featured.length > 0 && (
                <Section>
                  <FeaturedProducts title={t('home.featuredTitle')} products={data.featured} />
                </Section>
              )}
              {newArrivals.length > 0 && (
                <Section title={t('home.newArrivalsTitle')}>
                  <NewArrivalsGrid products={newArrivals} />
                </Section>
              )}
            </>
          ) : (
            <Section>
              <EmptyState
                title={t('home.empty.title')}
                description={t('home.empty.description')}
                actionLabel={t('hero.startSelling')}
                onAction={() => navigate('/sell')}
              />
            </Section>
          )}
        </>
      )}
      {/* Selling is explained in full on /sell; Home keeps a single invitation to it. Payment options
          are shown at checkout, where they matter, rather than as a strip here. */}
      <AiBanner />
    </div>
  );
}
