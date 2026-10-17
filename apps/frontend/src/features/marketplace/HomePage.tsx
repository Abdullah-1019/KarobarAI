import { Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { ArrowIcon, Button, EmptyState, Section } from '../../components';
import { Hero } from './Hero';
import { TrustStrip } from './TrustStrip';
import { ProductGridSkeleton } from './ProductGridSkeleton';
import { CategoryGrid } from './CategoryGrid';
import { FeaturedProducts } from './FeaturedProducts';
import { NewArrivalsGrid } from './NewArrivalsGrid';
import { AiBanner } from './AiBanner';
import { HOME_FEED_QUERY_KEY, getHomeFeed } from './marketplaceApi';
import { formatMarketplaceError } from './marketplaceErrors';

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

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: HOME_FEED_QUERY_KEY,
    queryFn: getHomeFeed,
  });

  const hasProducts = !!data && (data.featured.length > 0 || data.newArrivals.length > 0);

  return (
    <div>
      <Hero categories={data?.categories} />
      <TrustStrip />

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
                <Section tone="sand" title={t('home.featuredTitle')}>
                  <FeaturedProducts products={data.featured} />
                </Section>
              )}
              {data.newArrivals.length > 0 && (
                <Section title={t('home.newArrivalsTitle')}>
                  <NewArrivalsGrid products={data.newArrivals} />
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
