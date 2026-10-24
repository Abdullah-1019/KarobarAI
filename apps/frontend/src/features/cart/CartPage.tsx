import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, ShoppingBag, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import type { CartItemDTO, SellerCartGroupDTO } from '@karobarai/shared';
import { Button, EmptyState, PriceDisplay, ProductThumbnail, QuantityStepper, Skeleton, StatusTag, toast } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { HOME_FEED_QUERY_KEY, getHomeFeed } from '../marketplace/marketplaceApi';
import { ProductCard } from '../marketplace/ProductCard';
import { StoreMonogram } from '../marketplace/StoreMonogram';
import { CART_QUERY_KEY, getCart, removeCartItem, updateCartItem } from './cartApi';
import { formatCartError } from './cartErrors';
import { useGuestCartStore, type GuestCartItem } from './guestCartStore';

const PKR = new Intl.NumberFormat('en-PK');
const rs = (n: number | string) => `Rs. ${PKR.format(Number(n))}`;

// SCR-B04, Studio Light (Day 2). Items sit in one white card per store, because each store becomes
// its own order at checkout. A white summary card carries the one persimmon action; on phones a
// slim bar with the total and Checkout takes over while that card is off screen. Guests see the
// same page off the device-only cart, and Checkout sends them to log in first.
export function CartPage() {
  const { t } = useTranslation(['cart', 'marketplace']);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isBuyer = user?.role === 'BUYER';
  const queryClient = useQueryClient();
  const ctaRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [barVisible, setBarVisible] = useState(false);

  const { data: cart, isPending, isError, error, refetch } = useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: getCart,
    enabled: isBuyer,
  });

  const guestItems = useGuestCartStore((s) => s.items);
  const updateGuestQuantity = useGuestCartStore((s) => s.updateQuantity);
  const removeGuestItem = useGuestCartStore((s) => s.removeItem);

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => updateCartItem(itemId, quantity),
    onSuccess: (updated) => queryClient.setQueryData(CART_QUERY_KEY, updated),
    onError: (err) => toast.error(formatCartError(t, err)),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeCartItem(itemId),
    onSuccess: (updated) => queryClient.setQueryData(CART_QUERY_KEY, updated),
    onError: (err) => toast.error(formatCartError(t, err)),
  });

  const isEmpty = isBuyer ? (cart?.sellerGroups.length ?? 0) === 0 : guestItems.length === 0;
  const showEmpty = (!isBuyer || !isPending) && !isError && isEmpty;

  const feed = useQuery({ queryKey: HOME_FEED_QUERY_KEY, queryFn: getHomeFeed, enabled: showEmpty });

  // Phone bar: shown while the summary card's Checkout button is off screen (above or below).
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = ctaRef.current;
      if (!el) return setBarVisible(false);
      const r = el.getBoundingClientRect();
      setBarVisible(r.bottom < 0 || r.top > window.innerHeight);
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
  }, [isEmpty, cart]);

  useEffect(() => {
    if (barRef.current) barRef.current.inert = !barVisible;
  }, [barVisible]);

  if (isBuyer && isPending) {
    return (
      <div className="cart" aria-busy="true">
        <Skeleton height={44} width={260} style={{ display: 'block' }} />
        <div className="cart__layout">
          <div>
            <Skeleton height={260} radius="24px" style={{ display: 'block' }} />
          </div>
          <Skeleton height={300} radius="24px" style={{ display: 'block' }} />
        </div>
      </div>
    );
  }

  if (isBuyer && isError) {
    return (
      <div className="pdp-missing">
        <EmptyState headingLevel={1} title={t('page.title')} description={formatCartError(t, error)} actionLabel={t('common:actions.retry')} onAction={() => void refetch()} />
      </div>
    );
  }

  if (isEmpty) {
    const popular = (feed.data?.featured ?? []).slice(0, 4);
    return (
      <div className="cart cart--empty">
        <EmptyState
          headingLevel={1}
          icon={<ShoppingBag size={36} strokeWidth={1.6} aria-hidden="true" />}
          title={t('flow.emptyTitle')}
          description={t('flow.emptyBody')}
          actionLabel={t('page.browseCta')}
          onAction={() => navigate('/search')}
        />
        {popular.length > 0 && (
          <section className="section" aria-labelledby="cart-popular">
            <header className="section-head">
              <h2 id="cart-popular" className="section-title">
                {t('flow.popular')}
              </h2>
            </header>
            <div className="product-grid">
              {popular.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  const groups = cart?.sellerGroups ?? [];
  const itemCount = isBuyer
    ? groups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.quantity, 0), 0)
    : guestItems.reduce((n, i) => n + i.quantity, 0);
  const total = isBuyer ? Number(cart?.grandSubtotal ?? 0) : guestItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  const anyReady = !isBuyer || groups.some((g) => g.eligibleForCheckout);
  const someNotReady = isBuyer && groups.some((g) => !g.eligibleForCheckout);

  const goCheckout = () => (isBuyer ? navigate('/checkout') : navigate('/login', { state: { redirect: '/checkout' } }));

  function renderRow(key: string, opts: {
    productId: string;
    title: string;
    variant?: string | null;
    image: string | null;
    price: string;
    quantity: number;
    max?: number;
    busy?: boolean;
    warning?: ReactNode;
    onQty: (q: number) => void;
    onRemove: () => void;
  }) {
    return (
      <li key={key} className="cart-row">
        <Link to={`/product/${opts.productId}`} className="cart-row__thumb" tabIndex={-1} aria-hidden="true">
          <ProductThumbnail src={opts.image} fill radius="md" style={{ background: 'transparent' }} />
        </Link>
        <div className="cart-row__info">
          <Link to={`/product/${opts.productId}`} className="cart-row__title" dir="auto">
            {opts.title}
          </Link>
          {opts.variant && (
            <span className="cart-row__variant" dir="auto">
              {opts.variant}
            </span>
          )}
          <span className="cart-row__each">{t('flow.each', { price: rs(opts.price) })}</span>
          {opts.warning}
        </div>
        <div className="cart-row__qty">
          <QuantityStepper
            size="sm"
            value={opts.quantity}
            min={1}
            max={opts.max}
            disabled={opts.busy}
            onChange={opts.onQty}
            label={t('marketplace:product.quantity')}
            decreaseLabel={t('marketplace:pdp.decrease')}
            increaseLabel={t('marketplace:pdp.increase')}
          />
        </div>
        <span className="cart-row__total">
          <PriceDisplay amount={Number(opts.price) * opts.quantity} strong />
        </span>
        <button type="button" className="cart-row__remove" aria-label={t('flow.removeNamed', { title: opts.title })} onClick={opts.onRemove}>
          <Trash2 size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </li>
    );
  }

  function renderBuyerGroup(group: SellerCartGroupDTO) {
    const conflict = group.items.some((i) => i.stockConflict);
    const shortBy = Math.max(0, Number(group.minOrderValuePkr) - Number(group.subtotal));
    return (
      <section key={group.sellerId} className="cart-group" data-ready={group.eligibleForCheckout || undefined} aria-label={group.storeName}>
        <header className="cart-group__head">
          <StoreMonogram name={group.storeName} size={40} />
          <div className="cart-group__who">
            <h2 className="cart-group__name" dir="auto">
              {group.storeName}
            </h2>
            <span className="cart-group__sub">{t('flow.shipsSeparately')}</span>
          </div>
          {!group.eligibleForCheckout && <StatusTag variant="warning" label={t('flow.notReady')} />}
        </header>
        <ul className="cart-group__items">
          {group.items.map((item: CartItemDTO) =>
            renderRow(item.id, {
              productId: item.productId,
              title: item.titleEn,
              variant: item.variantLabel,
              image: item.primaryImageUrl,
              price: item.price,
              quantity: item.quantity,
              max: item.stockConflict?.available,
              busy: updateMutation.isPending || removeMutation.isPending,
              warning: item.stockConflict ? (
                <StatusTag variant="warning" label={t('item.stockConflict', { count: item.stockConflict.available })} />
              ) : undefined,
              onQty: (quantity) => updateMutation.mutate({ itemId: item.id, quantity }),
              onRemove: () => removeMutation.mutate(item.id),
            }),
          )}
        </ul>
        <footer className="cart-group__foot">
          {!group.eligibleForCheckout && (
            <p className="cart-group__note">
              {conflict ? t('flow.stockIssue') : t('flow.addMore', { amount: rs(shortBy), min: rs(group.minOrderValuePkr) })}
            </p>
          )}
          <div className="cart-group__subtotal">
            <span>{t('sellerGroup.subtotal')}</span>
            <PriceDisplay amount={group.subtotal} strong />
          </div>
        </footer>
      </section>
    );
  }

  function renderGuestGroup() {
    return (
      <section className="cart-group" aria-label={t('flow.yourItems')}>
        <header className="cart-group__head">
          <div className="cart-group__who">
            <h2 className="cart-group__name">{t('flow.yourItems')}</h2>
            <span className="cart-group__sub">{t('flow.guestNote')}</span>
          </div>
        </header>
        <ul className="cart-group__items">
          {guestItems.map((item: GuestCartItem) =>
            renderRow(`${item.productId}:${item.variantId ?? ''}`, {
              productId: item.productId,
              title: item.titleEn,
              variant: item.variantLabel,
              image: item.primaryImageUrl,
              price: item.price,
              quantity: item.quantity,
              onQty: (quantity) => updateGuestQuantity(item.productId, quantity, item.variantId),
              onRemove: () => removeGuestItem(item.productId, item.variantId),
            }),
          )}
        </ul>
      </section>
    );
  }

  return (
    <div className="cart">
      <header className="cart__head">
        <h1 className="cart__title">{t('page.title')}</h1>
        <p className="cart__count">
          {t('flow.items', { count: itemCount })}
          {isBuyer && groups.length > 0 && <> {t('flow.stores', { count: groups.length })}</>}
        </p>
      </header>

      <div className="cart__layout">
        <div className="cart__groups">{isBuyer ? groups.map(renderBuyerGroup) : renderGuestGroup()}</div>

        <aside className="cart-summary" aria-labelledby="cart-summary-title">
          <h2 id="cart-summary-title" className="cart-summary__title">
            {t('flow.summaryTitle')}
          </h2>
          <dl className="cart-summary__lines">
            <div>
              <dt>
                {t('flow.itemsLine')} <span className="cart-summary__muted">({itemCount})</span>
              </dt>
              <dd>
                <PriceDisplay amount={total} />
              </dd>
            </div>
            <div>
              <dt>{t('flow.shippingLine')}</dt>
              <dd className="cart-summary__muted">{t('flow.shippingValue')}</dd>
            </div>
          </dl>
          <div className="cart-summary__total">
            <span>{t('flow.totalBeforeShipping')}</span>
            <PriceDisplay amount={total} size="lg" strong />
          </div>
          <div ref={ctaRef}>
            <Button size="lg" fullWidth arrow disabled={!anyReady} onClick={goCheckout}>
              {t('page.checkout')}
            </Button>
          </div>
          {someNotReady && <p className="cart-summary__warn">{t('flow.someNotReady')}</p>}
          {isBuyer && (
            <p className="cart-summary__cod">
              <Banknote size={18} strokeWidth={1.8} aria-hidden="true" />
              {t('flow.codNote')}
            </p>
          )}
        </aside>
      </div>

      <div className="cart-bar" ref={barRef} data-visible={barVisible || undefined}>
        <span className="cart-bar__total">
          <small>{t('flow.totalBeforeShipping')}</small>
          <PriceDisplay amount={total} strong />
        </span>
        <Button disabled={!anyReady} onClick={goCheckout}>
          {t('page.checkout')}
        </Button>
      </div>
    </div>
  );
}
