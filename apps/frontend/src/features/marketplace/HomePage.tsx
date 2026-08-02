import { Alert, Button, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { SkeletonLoader } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { CategoryGrid } from './CategoryGrid';
import { ProductCard } from './ProductCard';
import { HOME_FEED_QUERY_KEY, getHomeFeed } from './marketplaceApi';
import { formatMarketplaceError } from './marketplaceErrors';

// SCR-B01 — entry + discovery. Identical content for Guest and authenticated Buyer (no
// personalization in MVP scope, per F5-marketplace-backend.md's Known limitations).
export function HomePage() {
  const { t } = useTranslation(['marketplace']);
  const user = useAuthStore((s) => s.user);

  const { data, isPending, isError, error } = useQuery({ queryKey: HOME_FEED_QUERY_KEY, queryFn: getHomeFeed });

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      {!user && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
          <Link to="/login">
            <Button>{t('home.loginCta')}</Button>
          </Link>
          <Link to="/register">
            <Button type="primary">{t('home.registerCta')}</Button>
          </Link>
        </div>
      )}

      {isPending && <SkeletonLoader rows={6} />}

      {isError && <Alert type="error" showIcon message={formatMarketplaceError(t, error)} />}

      {data && (
        <>
          <Typography.Title level={4}>{t('home.browseCategories')}</Typography.Title>
          <CategoryGrid categories={data.categories} />

          <Typography.Title level={4} style={{ marginTop: 32 }}>
            {t('home.featuredTitle')}
          </Typography.Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {data.featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <Typography.Title level={4} style={{ marginTop: 32 }}>
            {t('home.newArrivalsTitle')}
          </Typography.Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {data.newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
