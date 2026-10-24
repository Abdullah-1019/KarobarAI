import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Heart, Plus } from 'lucide-react';

import type { ProductDetailDTO } from '@karobarai/shared';
import { Badge, PriceDisplay, ProductThumbnail, toast } from '../../components';
import { useLanguage } from '../../hooks';
import { useAddToCart } from '../cart/useAddToCart';
import { tintFor } from './categoryVisuals';
import { useSavedStore } from './savedStore';

interface ProductCardProps {
  product: ProductDetailDTO;
}

// "New" is recency-derived (no is_new/is_featured column exists in the schema — the same gap the
// backend home feed documents). A 14-day window gives the badge a shelf life of its own instead of
// stamping every listing as new the day it appears.
const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
// "Only X left" urgency threshold — read from the real `stock` field only, never invented.
const LOW_STOCK_MAX = 5;
// How long the add button shows its ✓ before turning back into "+" (DESIGN-CONSULT §7).
const ADDED_MS = 1500;

function isNew(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  return !Number.isNaN(created) && Date.now() - created < NEW_WINDOW_MS;
}

// Studio Light product card (DESIGN-CONSULT §4, §6, §7; the sample Home design): a borderless
// white 24px card resting on a soft two-layer shadow, the product art on its category's tint, an
// ink "New" pill or a red "Only X left" pill, a heart that saves on this device, the title with
// its other-language twin under it (Urdu in Nastaliq beside English), an Outfit price, and a
// persimmon "+" that turns into a ✓ when the item is really in the cart.
//
// The whole card is clickable via a "stretched link": the title <Link> paints a ::after cover over
// the card (z-index 1) instead of wrapping the markup, so the heart and "+" buttons sit alongside it
// without nesting interactive elements inside an anchor.
//
// Not here, because the data doesn't exist (PRODUCT.md "Data gaps"): a "-X%" sale sticker (no
// compare-at price), a seller name or city, a verified tick, ratings.
export function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation(['marketplace']);
  const { language } = useLanguage();
  const { addToCart, isAdding } = useAddToCart();
  const navigate = useNavigate();
  const saved = useSavedStore((state) => state.ids.includes(product.id));
  const toggleSaved = useSavedStore((state) => state.toggle);
  const [added, setAdded] = useState(false);
  const [heartPop, setHeartPop] = useState(false);
  const addedTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const isUr = language === 'UR';
  const title = isUr && product.titleUr ? product.titleUr : product.titleEn;
  // The other-language name, shown under the title so the card is bilingual at a glance.
  const twin = isUr ? product.titleEn : product.titleUr;
  const category = product.category ? (isUr ? product.category.nameUr : product.category.nameEn) : null;
  const image = product.images[0]?.url ?? null;
  const outOfStock = product.stock <= 0 || product.status !== 'LIVE';
  const showNew = !outOfStock && isNew(product.createdAt);
  const lowStock = !outOfStock && product.stock <= LOW_STOCK_MAX;

  const onAdd = async () => {
    // Feature 23 — a size/colour has to be chosen first, on the product page.
    if (product.variants?.length) {
      navigate(`/product/${product.id}`);
      return;
    }
    const ok = await addToCart(product);
    if (!ok) return;
    window.clearTimeout(addedTimer.current);
    setAdded(true);
    addedTimer.current = window.setTimeout(() => setAdded(false), ADDED_MS);
  };

  const onSave = () => {
    const nowSaved = toggleSaved(product.id);
    setHeartPop(nowSaved);
    toast.success(t(nowSaved ? 'product.saved' : 'product.unsaved'));
  };

  return (
    <article className="product-card" data-out-of-stock={outOfStock || undefined}>
      <div className="product-card__media" style={{ background: tintFor(product.category?.slug ?? '') }}>
        <ProductThumbnail
          src={image}
          alt=""
          fill
          style={{ aspectRatio: '4 / 5', borderRadius: 0, background: 'transparent' }}
        />
        {outOfStock && <span className="product-card__stock" aria-hidden="true" />}
        {(showNew || lowStock || outOfStock) && (
          <span className="product-card__badges">
            {showNew && <Badge variant="new">{t('product.new')}</Badge>}
            {lowStock && <Badge variant="low-stock">{t('product.onlyLeft', { count: product.stock })}</Badge>}
            {outOfStock && <Badge variant="out-of-stock">{t('product.outOfStock')}</Badge>}
          </span>
        )}
        <button
          type="button"
          className={`product-card__save${heartPop ? ' is-popping' : ''}`}
          aria-pressed={saved}
          aria-label={t('product.save', { title })}
          onClick={onSave}
          onAnimationEnd={() => setHeartPop(false)}
        >
          <Heart size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="product-card__body">
        {category && <span className="product-card__category">{category}</span>}
        <h3 className="product-card__title">
          <Link to={`/product/${product.id}`} className="product-card__link">
            {title}
          </Link>
        </h3>
        {twin && twin !== title && (
          <span className="product-card__twin" lang={isUr ? 'en' : 'ur'} dir={isUr ? 'ltr' : 'rtl'}>
            {twin}
          </span>
        )}
        <div className="product-card__foot">
          <span className="product-card__price">
            <PriceDisplay amount={product.price} strong />
          </span>
          {!outOfStock && (
            <button
              type="button"
              className="product-card__add"
              data-state={added ? 'added' : 'idle'}
              aria-label={added ? t('product.added') : t('product.addNamed', { title })}
              onClick={onAdd}
              disabled={isAdding}
            >
              <Plus className="product-card__add-plus" size={22} strokeWidth={2.2} aria-hidden="true" />
              <Check className="product-card__add-check" size={22} strokeWidth={2.4} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
