import { Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SectionHeader } from '../../components';
import { ProductGridSkeleton } from './ProductGridSkeleton';
import { CategoryGrid } from './CategoryGrid';
import { ProductGrid } from './ProductGrid';
import { HOME_FEED_QUERY_KEY, getHomeFeed } from './marketplaceApi';
import { formatMarketplaceError } from './marketplaceErrors';

// SCR-B01 — entry + discovery. Identical content for Guest and authenticated Buyer (no
// personalization in MVP scope, per F5-marketplace-backend.md's Known limitations). No outer
// max-width/padding wrapper — AppShell's shared content area (Phase C) already provides both, so
// this page uses the full width it's given rather than a second, narrower, redundant container.
//
// The guest login/register CTA previously duplicated here (a second pair of buttons stacked
// directly under the header) was removed — AppHeader's own `guestActions` slot (StorefrontLayout)
// already renders the identical pair; this page doesn't need its own copy.
export function HomePage() {
  const { t } = useTranslation(['marketplace']);

  const { data, isPending, isError, error } = useQuery({ queryKey: HOME_FEED_QUERY_KEY, queryFn: getHomeFeed });

  return (
    <div>
      {isPending && (
        <>
          <ProductGridSkeleton count={8} variant="category" />
          <ProductGridSkeleton count={6} style={{ marginTop: 'var(--sp-8)' }} />
        </>
      )}

      {isError && <Alert type="error" showIcon message={formatMarketplaceError(t, error)} />}

      {data && (
        <>
          <SectionHeader title={t('home.browseCategories')} />
          <CategoryGrid categories={data.categories} />

          <SectionHeader title={t('home.featuredTitle')} style={{ marginTop: 'var(--sp-10)' }} />
          <ProductGrid products={data.featured} />

          <SectionHeader title={t('home.newArrivalsTitle')} style={{ marginTop: 'var(--sp-10)' }} />
          <ProductGrid products={data.newArrivals} />
        </>
      )}
    </div>
  );
}
