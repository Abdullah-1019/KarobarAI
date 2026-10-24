import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { ArrowIcon } from '../../components';
import { CATEGORY_ART, ruleFor, tintFor } from './categoryVisuals';
import { StoreMonogram } from './StoreMonogram';
import { getPublicStorefront, type StoreDirectoryItem } from './storeApi';

const NEW_STORE_DAYS = 30;

// The store card used on Home ("Shop by Store") and All Stores (/stores), laid out in `.sd-grid`.
// The directory endpoints carry no banner or product photos (BACKEND-NOTES), so each card also
// reads that store's public storefront, the same ['storefront', slug] query the store page uses,
// which makes opening a store instant. Everything on the card is the store's own data.
export function StoreCard({ store, isUr }: { store: StoreDirectoryItem; isUr: boolean }) {
  const { t } = useTranslation(['marketplace']);
  const storefront = useQuery({
    queryKey: ['storefront', store.slug],
    queryFn: () => getPublicStorefront(store.slug),
    staleTime: 5 * 60_000,
  });
  const bannerUrl = storefront.data?.store.bannerUrl ?? null;
  const photos = (storefront.data?.products ?? []).filter((product) => !!product.imageUrl);
  const categoryName = store.category ? (isUr ? store.category.nameUr : store.category.nameEn) : null;
  const description = isUr ? (store.descriptionUr ?? store.description) : (store.description ?? store.descriptionUr);
  const since = new Date(store.memberSince);
  const isNew = Date.now() - since.getTime() < NEW_STORE_DAYS * 86_400_000;
  const rule = ruleFor(store.category?.slug ?? '');
  const art = CATEGORY_ART[rule.key];
  const CategoryIcon = rule.icon;
  const tint = tintFor(store.category?.slug ?? '');
  const strip = bannerUrl ? photos.slice(0, 4) : [];
  const extra = Math.max(0, store.productCount - strip.length);

  return (
    <Link to={`/store/${encodeURIComponent(store.slug)}`} className="sd-card">
      <span className="sd-card__banner" style={{ background: tint }} aria-hidden="true">
        {bannerUrl ? (
          <img className="sd-card__banner-img" src={bannerUrl} alt="" loading="lazy" />
        ) : photos.length > 0 ? (
          <span className="sd-card__window" data-count={Math.min(photos.length, 3)}>
            {photos.slice(0, 3).map((product) => (
              <span key={product.id} className="sd-card__window-tile">
                <img src={product.imageUrl ?? ''} alt="" loading="lazy" />
              </span>
            ))}
          </span>
        ) : art ? (
          <img className="sd-card__art" src={art} alt="" loading="lazy" />
        ) : (
          <CategoryIcon className="sd-card__icon" size={56} strokeWidth={1.4} />
        )}
        {isNew && <span className="sd-card__new">{t('directory.newStore')}</span>}
      </span>

      <span className="sd-card__body">
        <span className="sd-card__top">
          <StoreMonogram name={store.name} logoUrl={store.logoUrl} size={68} className="sd-card__logo" />
          {categoryName && <span className="sd-card__cat">{categoryName}</span>}
        </span>

        <span className="sd-card__who">
          <span className="sd-card__name" dir="auto">
            {store.name}
          </span>
          {store.city && (
            <span className="sd-card__city" dir="auto">
              <MapPin size={14} aria-hidden="true" />
              {store.city}
            </span>
          )}
        </span>

        {description && (
          <span className="sd-card__desc" dir="auto">
            {description}
          </span>
        )}

        {strip.length > 0 && (
          <span className="sd-card__strip" aria-hidden="true">
            {strip.map((product) => (
              <span key={product.id} className="sd-card__thumb">
                <img src={product.imageUrl ?? ''} alt="" loading="lazy" />
              </span>
            ))}
            {extra > 0 && <span className="sd-card__thumb sd-card__thumb--more">{t('directory.moreProducts', { count: extra })}</span>}
          </span>
        )}

        <span className="sd-card__facts">
          <span className="sd-card__fact">
            <Package size={14} aria-hidden="true" />
            {store.productCount > 0 ? t('store.products', { count: store.productCount }) : t('directory.noProductsYet')}
          </span>
          <span className="sd-card__fact">
            <CalendarDays size={14} aria-hidden="true" />
            {t('directory.since', {
              date: since.toLocaleDateString(isUr ? 'ur-PK' : 'en-PK', { month: 'short', year: 'numeric' }),
            })}
          </span>
        </span>

        {/* The whole card is the link; this is its visible call to action. */}
        <span className="sd-card__visit">
          {t('directory.visit')}
          <ArrowIcon size={16} />
        </span>
      </span>
    </Link>
  );
}
