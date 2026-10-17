import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { ProductDetailDTO } from '@karobarai/shared';
import { Badge, PriceDisplay, ProductThumbnail, StatusTag } from '../../components';
import { useLanguage } from '../../hooks';
import { useAddToCart } from '../cart/useAddToCart';

interface ProductCardProps {
  product: ProductDetailDTO;
}

// "New" is recency-derived (no is_new/is_featured column exists in the schema — the same gap the
// backend home feed documents). A 14-day window gives the badge a shelf life of its own instead of
// stamping every listing as new the day it appears.
const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
// "Only X left" urgency threshold — read from the real `stock` field only, never invented.
const LOW_STOCK_MAX = 5;

function isNew(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  return !Number.isNaN(created) && Date.now() - created < NEW_WINDOW_MS;
}

// Haveli product card (Batch 0.6): a cream card with a 4:5 photo that zooms gently on hover while
// the card lifts, a brass NEW sticker, a sindoor "Only X left" pill when stock is genuinely low, an
// espresso price, and a one-tap "quick add" that slides up on desktop hover. Cash on Delivery is a
// site-wide promise (stated once in the shell), so it is no longer repeated on every card.
//
// The whole card is clickable via a "stretched link": the title <Link> paints a ::after cover over
// the card (z-index 1) instead of wrapping the markup, so the quick-add <button> can sit alongside
// it without nesting an interactive element inside an anchor (invalid HTML, and a dead tap target
// on touch). The button only appears under `@media (hover: hover)` — on touch, tapping the card
// opens the product, where a full quantity stepper exists.
//
// Two spec pieces are deliberately NOT here, because the data backing them doesn't exist and rule L
// forbids schema/backend changes in this phase: a "-X%" sale sticker (no compare-at price on
// ProductDetailDTO) and a seller name/verified tick (no seller fields on the DTO). A wishlist heart
// is also omitted — Wishlist is Future (F17) with "no affordance for it anywhere" (ProductDetailPage),
// so a non-persisting heart here would be a fake control.
export function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation(['marketplace']);
  const { language } = useLanguage();
  const { addToCart, isAdding } = useAddToCart();
  const title = language === 'UR' && product.titleUr ? product.titleUr : product.titleEn;
  const image = product.images[0]?.url ?? null;
  const outOfStock = product.stock <= 0 || product.status !== 'LIVE';
  const showNew = !outOfStock && isNew(product.createdAt);
  const lowStock = !outOfStock && product.stock <= LOW_STOCK_MAX;

  return (
    <article className="product-card">
      <div className="product-card__media">
        <ProductThumbnail
          src={image}
          alt=""
          fill
          radius="md"
          style={{ aspectRatio: '4 / 5', borderRadius: 'var(--radius-md)' }}
        />
        {(showNew || lowStock) && (
          <span className="product-card__badges">
            {showNew && <Badge variant="new">{t('product.new')}</Badge>}
            {lowStock && <Badge variant="low-stock">{t('product.onlyLeft', { count: product.stock })}</Badge>}
          </span>
        )}
        {outOfStock && (
          <span className="product-card__stock">
            <StatusTag variant="error" label={t('product.outOfStock')} />
          </span>
        )}
        {!outOfStock && (
          <button
            type="button"
            className="product-card__quick-add"
            onClick={() => addToCart(product)}
            disabled={isAdding}
          >
            {t('product.quickAdd')}
          </button>
        )}
      </div>

      <div className="product-card__body">
        <h3 className="product-card__title">
          <Link to={`/product/${product.id}`} className="product-card__link">
            {title}
          </Link>
        </h3>
        <div className="product-card__price">
          <PriceDisplay amount={product.price} size="md" strong />
        </div>
      </div>
    </article>
  );
}
