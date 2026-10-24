import { useEffect, useRef, useState } from 'react';
import { Banknote, Check, Heart, MessageCircle, MessagesSquare, RotateCcw, ShoppingBag, Truck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AiMark, ArrowIcon, Badge, Breadcrumb, Button, CountBadge, EmptyState, PriceDisplay, QuantityStepper, Skeleton, toast } from '../../components';
import { useLanguage } from '../../hooks';
import { ApiError } from '../../api';
import { useAiUnreadStore } from '../../lib/aiUnreadStore';
import { useAuthStore } from '../../lib/authStore';
import { getProduct, productQueryKey } from '../catalog/catalogApi';
import { formatCatalogError } from '../catalog/catalogErrors';
import { CART_QUERY_KEY, addCartItem } from '../cart/cartApi';
import { useGuestCartStore } from '../cart/guestCartStore';
import { useAddToCart } from '../cart/useAddToCart';
import { VariantPicker } from './VariantPicker';
import { tintFor } from './categoryVisuals';
import { ProductCard } from './ProductCard';
import { ProductGallery } from './ProductGallery';
import { useSavedStore } from './savedStore';
import { StoreChatWidget } from './StoreChatWidget';
import { StoreMonogram } from './StoreMonogram';
import { getPublicStorefront, getStoreForProduct, toCardProduct } from './storeApi';

// Same real-stock threshold as the product card: "Only X left" reads the `stock` field, never invents.
const LOW_STOCK_MAX = 5;
const ADDED_MS = 1500;

// SCR-B03 — evaluate + buy, Studio Light (Day 2). The gallery is the page's one signature motion;
// the buy column carries the one persimmon action (Add to cart) with an ink Buy now beside it. On
// phones a slim action bar slides up from the bottom only once those buttons scroll away, so there
// is still one persimmon on screen at a time. The store card shows only what the API returns (the
// store's name and link); there is no seller rating, city or verified flag to show.
export function ProductDetailPage() {
  const { t } = useTranslation(['marketplace', 'catalog', 'common']);
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isUr = language === 'UR';
  const { addToCart, isAdding } = useAddToCart();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const addGuestItem = useGuestCartStore((s) => s.addItem);
  const saved = useSavedStore((state) => state.ids.includes(id));
  const toggleSaved = useSavedStore((state) => state.toggle);

  const [quantity, setQuantity] = useState(1);
  // Feature 23 — the chosen size/colour, and whether an add was tried without one.
  const [variantId, setVariantId] = useState<string | null>(null);
  const [variantMissing, setVariantMissing] = useState(false);
  const [added, setAdded] = useState(false);
  const [buying, setBuying] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const addedTimer = useRef<number>();

  const { data: product, isPending, isError, error, refetch } = useQuery({
    queryKey: productQueryKey(id),
    queryFn: () => getProduct(id),
    enabled: !!id,
  });
  const storeQuery = useQuery({
    queryKey: ['product-store', id],
    queryFn: () => getStoreForProduct(id),
    enabled: !!product && product.status === 'LIVE',
  });
  const storeSlug = storeQuery.data?.slug ?? '';
  const aiUnseen = useAiUnreadStore((s) => s.buyer[storeSlug] ?? 0);
  const storefrontQuery = useQuery({
    queryKey: ['storefront', storeSlug],
    queryFn: () => getPublicStorefront(storeSlug),
    enabled: !!storeSlug,
  });

  // New product → fresh quantity, closed reader, top of the page.
  useEffect(() => {
    setQuantity(1);
    setVariantId(null);
    setVariantMissing(false);
    setShowOther(false);
    setChatOpen(false);
    window.scrollTo({ top: 0 });
  }, [id]);

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  // The phone action bar appears only once the in-page buttons have scrolled up off screen. A
  // scroll check rather than an IntersectionObserver: a fast fling (or a jump back from another
  // page) can carry the buttons from below the fold to above it without ever "intersecting".
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = actionsRef.current;
      setBarVisible(!!el && el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [product?.id]);

  // While the bar is parked off screen it must not take focus or reach screen readers.
  useEffect(() => {
    if (barRef.current) barRef.current.inert = !barVisible;
  }, [barVisible, product?.id]);

  if (isPending) return <ProductDetailSkeleton />;

  if (isError || !product) {
    // A missing/invalid product is a dead end with a way out; anything else (network, server) is
    // a failure the buyer can retry.
    // A malformed id gets a 500 from the API today (BACKEND-NOTES), so it is caught here too.
    const notFound =
      !/^[0-9a-f-]{36}$/i.test(id) || !(error instanceof ApiError) || /NOT_FOUND|VALIDATION/.test(error.code);
    return (
      <div className="pdp-missing">
        {notFound ? (
          <EmptyState
            headingLevel={1}
            title={t('pdp.notFoundTitle')}
            description={t('pdp.notFoundBody')}
            actionLabel={t('pdp.browse')}
            onAction={() => navigate('/search')}
          />
        ) : (
          <EmptyState
            headingLevel={1}
            title={t('pdp.loadErrorTitle')}
            description={formatCatalogError(t, error)}
            actionLabel={t('common:actions.retry')}
            onAction={() => void refetch()}
          />
        )}
      </div>
    );
  }

  const title = isUr && product.titleUr ? product.titleUr : product.titleEn;
  const twin = isUr ? product.titleEn : product.titleUr;
  const description = isUr && product.descriptionUr ? product.descriptionUr : product.descriptionEn;
  const otherDescription = isUr ? product.descriptionEn : product.descriptionUr;
  const categoryName = product.category ? (isUr ? product.category.nameUr : product.category.nameEn) : null;
  const variants = product.variants ?? [];
  // A single in-stock option is chosen for the buyer; otherwise they pick one.
  const onlyVariant = variants.length === 1 && (variants[0]?.stock ?? 0) > 0 ? variants[0] : undefined;
  const variant = variants.find((v) => v.id === variantId) ?? onlyVariant;
  const outOfStock = product.stock <= 0 || product.status !== 'LIVE';
  // Stock shown and allowed in the stepper: the chosen option's own, else the product total.
  const stock = variant ? variant.stock : product.stock;
  const lowStock = !outOfStock && stock <= LOW_STOCK_MAX;
  const isBuyerOrGuest = !user || user.role === 'BUYER';
  const canBuy = isBuyerOrGuest && !outOfStock;
  const store = storeQuery.data;
  const moreFromStore = (storefrontQuery.data?.products ?? []).filter((p) => p.id !== product.id).slice(0, 4);

  function needsVariant(): boolean {
    if (variants.length && !variant) {
      setVariantMissing(true);
      return true;
    }
    return false;
  }

  async function onAdd() {
    if (!product || needsVariant()) return;
    const ok = await addToCart(product, quantity, variant);
    if (!ok) return;
    window.clearTimeout(addedTimer.current);
    setAdded(true);
    addedTimer.current = window.setTimeout(() => setAdded(false), ADDED_MS);
  }

  async function buyNow() {
    if (!product || needsVariant()) return;
    if (!user) {
      addGuestItem(
        {
          productId: product.id,
          titleEn: product.titleEn,
          price: product.price,
          primaryImageUrl: product.images[0]?.url ?? null,
          ...(variant ? { variantId: variant.id, variantLabel: variant.label } : {}),
        },
        quantity,
      );
      navigate('/login', { state: { redirect: '/checkout' } });
      return;
    }
    setBuying(true);
    try {
      const cart = await addCartItem({ productId: id, quantity, ...(variant ? { variantId: variant.id } : {}) });
      queryClient.setQueryData(CART_QUERY_KEY, cart);
      navigate('/checkout');
    } catch (err) {
      toast.error(formatCatalogError(t, err));
    } finally {
      setBuying(false);
    }
  }

  function onSave() {
    const nowSaved = toggleSaved(product!.id);
    toast.success(t(nowSaved ? 'product.saved' : 'product.unsaved'));
  }

  const addLabel = added ? t('product.added') : t('product.addToCart');
  const addIcon = added ? <Check size={18} strokeWidth={2.4} aria-hidden="true" /> : undefined;

  return (
    <div className={`pdp${canBuy ? ' pdp--buyable' : ''}`}>
      <Breadcrumb
        className="pdp__crumbs"
        items={[
          { label: t('common:nav.home'), to: '/' },
          ...(product.category && categoryName ? [{ label: categoryName, to: `/category/${product.category.slug}` }] : []),
          { label: title },
        ]}
      />

      <div className="pdp__layout">
        <div className="pdp__media">
          <ProductGallery
            images={product.images}
            tint={tintFor(product.category?.slug ?? '')}
            title={title}
            badges={
              <>
                {product.aiGenerated && (
                  <span className="pdp-ai-tag">
                    <AiMark size={13} color="var(--ai-accent)" />
                    {t('pdp.aiWritten')}
                  </span>
                )}
              </>
            }
            corner={
              <button
                type="button"
                className="pdp-save"
                aria-pressed={saved}
                aria-label={t('product.save', { title })}
                onClick={onSave}
              >
                <Heart size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            }
          />

          {(description || otherDescription) && (
            <section className="pdp-about" aria-labelledby="pdp-about-title">
              <h2 id="pdp-about-title" className="pdp-about__title">
                {t('pdp.aboutTitle')}
              </h2>
              {description && <p className="pdp-about__text">{description}</p>}
              {otherDescription && otherDescription !== description && (
                <>
                  <button
                    type="button"
                    className="pdp-about__toggle"
                    aria-expanded={showOther}
                    onClick={() => setShowOther((v) => !v)}
                  >
                    {isUr ? t('pdp.readEn') : t('pdp.readUr')}
                  </button>
                  {showOther && (
                    <p className="pdp-about__text pdp-about__text--other" lang={isUr ? 'en' : 'ur'} dir={isUr ? 'ltr' : 'rtl'}>
                      {otherDescription}
                    </p>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        <aside className="pdp__buy" aria-labelledby="pdp-title">
          <h1 id="pdp-title" className="pdp-title">
            {title}
          </h1>
          {twin && twin !== title && (
            <p className="pdp-twin" lang={isUr ? 'en' : 'ur'} dir={isUr ? 'ltr' : 'rtl'}>
              {twin}
            </p>
          )}

          <div className="pdp-price">
            <PriceDisplay amount={product.price} size="lg" strong />
            <span className="pdp-condition">{t(`catalog:condition.${product.condition}`)}</span>
          </div>

          <p className="pdp-stock" data-state={outOfStock ? 'out' : lowStock ? 'low' : 'in'}>
            {outOfStock ? (
              <Badge variant="out-of-stock">{t('product.outOfStock')}</Badge>
            ) : lowStock ? (
              <Badge variant="low-stock">{t('product.onlyLeft', { count: stock })}</Badge>
            ) : (
              <>
                <span className="pdp-stock__dot" aria-hidden="true" />
                <span className="pdp-stock__label">{t('pdp.inStock')}</span>
                <span className="pdp-stock__count">{t('pdp.available', { count: stock })}</span>
              </>
            )}
          </p>

          {canBuy ? (
            <>
              {variants.length > 0 && (
                <VariantPicker
                  variants={variants}
                  value={variant?.id ?? null}
                  showRequired={variantMissing && !variant}
                  onChange={(next) => {
                    setVariantId(next);
                    setVariantMissing(false);
                    const chosen = variants.find((v) => v.id === next);
                    if (chosen) setQuantity((q) => Math.min(q, Math.max(chosen.stock, 1)));
                  }}
                />
              )}
              <div className="pdp-qty">
                <span className="pdp-qty__label" id="pdp-qty-label">
                  {t('product.quantity')}
                </span>
                <QuantityStepper
                  value={quantity}
                  min={1}
                  max={Math.max(stock, 1)}
                  onChange={setQuantity}
                  label={t('product.quantity')}
                  decreaseLabel={t('pdp.decrease')}
                  increaseLabel={t('pdp.increase')}
                />
              </div>
              <div className="pdp-actions" ref={actionsRef}>
                <Button size="lg" variant="primary" fullWidth loading={isAdding} icon={addIcon} onClick={() => void onAdd()}>
                  {addLabel}
                </Button>
                <Button size="lg" variant="secondary" fullWidth loading={buying} onClick={() => void buyNow()}>
                  {t('product.buyNow')}
                </Button>
              </div>
            </>
          ) : (
            <p className="pdp-note">{outOfStock ? t('pdp.soldOut') : t('pdp.buyerOnly')}</p>
          )}

          <section className="pdp-assure" aria-labelledby="pdp-assure-title">
            <h2 id="pdp-assure-title" className="sr-only">
              {t('pdp.assureTitle')}
            </h2>
            <ul>
              <li>
                <span className="pdp-assure__icon pdp-assure__icon--cod">
                  <Banknote size={20} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span>
                  <strong>{t('pdp.assureCod')}</strong>
                  <small>{t('pdp.assureCodSub')}</small>
                </span>
              </li>
              <li>
                <span className="pdp-assure__icon pdp-assure__icon--returns">
                  <RotateCcw size={20} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span>
                  <strong>{t('pdp.assureReturns')}</strong>
                  <small>{t('pdp.assureReturnsSub')}</small>
                </span>
              </li>
              <li>
                <span className="pdp-assure__icon pdp-assure__icon--tracking">
                  <Truck size={20} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span>
                  <strong>{t('pdp.assureTracking')}</strong>
                  <small>{t('pdp.assureTrackingSub')}</small>
                </span>
              </li>
            </ul>
          </section>

          {store && (
            <section className="pdp-store" aria-label={t('pdp.soldBy')}>
              <StoreMonogram name={store.name} size={52} />
              <div className="pdp-store__who">
                <span className="pdp-store__caption">{t('pdp.soldBy')}</span>
                <Link className="pdp-store__name" dir="auto" to={`/store/${encodeURIComponent(store.slug)}`}>
                  {store.name}
                </Link>
              </div>
              <div className="pdp-store__actions">
                <span className="count-anchor">
                  <Button variant="outline" size="sm" fullWidth icon={<MessageCircle size={16} aria-hidden="true" />} onClick={() => setChatOpen(true)}>
                    {t('pdp.askStore')}
                  </Button>
                  <CountBadge count={aiUnseen} />
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  icon={<MessagesSquare size={16} aria-hidden="true" />}
                  to={`/messages?store=${encodeURIComponent(store.slug)}&product=${encodeURIComponent(id)}`}
                >
                  {t('humanChat:start')}
                </Button>
              </div>
            </section>
          )}
        </aside>
      </div>

      {store && moreFromStore.length > 0 && (
        <section className="section pdp-more" aria-labelledby="pdp-more-title">
          <header className="section-head">
            <div className="section-head-text">
              <h2 id="pdp-more-title" className="section-title">
                <Trans t={t} i18nKey="pdp.moreFrom" values={{ store: store.name }} components={{ bdi: <bdi /> }} />
              </h2>
            </div>
            <div className="section-action">
              <Link to={`/store/${encodeURIComponent(store.slug)}`} className="section-action-link">
                {t('pdp.visitStore')}
                <ArrowIcon size={16} />
              </Link>
            </div>
          </header>
          <div className="product-grid">
            {moreFromStore.map((p) => (
              <ProductCard key={p.id} product={toCardProduct(p)} />
            ))}
          </div>
        </section>
      )}

      {canBuy && (
        <div className="pdp-bar" ref={barRef} data-visible={barVisible || undefined}>
          <span className="pdp-bar__price">
            <PriceDisplay amount={product.price} strong />
          </span>
          <Button variant="secondary" loading={buying} onClick={() => void buyNow()}>
            {t('product.buyNow')}
          </Button>
          {/* On the narrowest phones the label folds away behind its icon so the price stays. */}
          <Button
            variant="primary"
            className="pdp-bar__add"
            aria-label={addLabel}
            loading={isAdding}
            icon={addIcon ?? <ShoppingBag size={18} strokeWidth={2} aria-hidden="true" />}
            onClick={() => void onAdd()}
          >
            <span className="pdp-bar__add-label">{addLabel}</span>
          </Button>
        </div>
      )}

      {store && (
        <StoreChatWidget
          storeSlug={store.slug}
          storeName={store.name}
          locale={isUr ? 'ur' : 'en'}
          open={chatOpen}
          onOpenChange={setChatOpen}
          showLauncher={false}
          productTitle={title}
          productId={product.id}
        />
      )}
    </div>
  );
}

// Loading state in the page's own shape (stage + buy column), so nothing jumps when data lands.
function ProductDetailSkeleton() {
  return (
    <div className="pdp" aria-busy="true">
      <div className="pdp__layout">
        <div className="pdp__media">
          <Skeleton height={0} radius="28px" style={{ aspectRatio: '6 / 5', height: 'auto' }} />
        </div>
        <div className="pdp__buy">
          <Skeleton height={40} width="80%" />
          <Skeleton height={24} width="50%" style={{ marginTop: 12 }} />
          <Skeleton height={44} width="40%" style={{ marginTop: 28 }} />
          <Skeleton height={52} style={{ marginTop: 32 }} radius="999px" />
          <Skeleton height={52} style={{ marginTop: 12 }} radius="999px" />
          <Skeleton height={180} style={{ marginTop: 28 }} radius="20px" />
        </div>
      </div>
    </div>
  );
}
