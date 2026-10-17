import { useEffect, useRef, useState } from 'react';
import { Alert } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Banknote, Check, CreditCard, ShieldCheck, Smartphone } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import type { AddressDTO, CreatedOrderDTO, PaymentMethod } from '@karobarai/shared';
import { ApiError } from '../../api';
import { Button, EmptyState, PriceDisplay, ProductThumbnail, Skeleton } from '../../components';
import { StoreMonogram } from '../marketplace/StoreMonogram';
import { AddressPicker } from './AddressPicker';
import { formatAddress } from './addressFormat';
import { ADDRESSES_QUERY_KEY, CART_QUERY_KEY, checkout, getCart, getOrderPaymentStatus, getPaymentConfig, listAddresses, reconcileOrderPayment } from './cartApi';
import { formatCartError } from './cartErrors';
import { StripePaymentForm } from './StripePaymentForm';

const PAYMENT_METHODS: PaymentMethod[] = ['COD', 'STRIPE', 'JAZZCASH', 'EASYPAISA'];
const PAYMENT_METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  COD: Banknote,
  STRIPE: CreditCard,
  JAZZCASH: Smartphone,
  EASYPAISA: Smartphone,
};

type Step = 1 | 2 | 3;

const PENDING_STRIPE_CHECKOUT_KEY = 'karobarai.pending-stripe-checkout';

// SCR-B05 — commission is intentionally never rendered here; the backend already omits it from
// every buyer-facing cart/order response, so there's nothing to filter client-side.
//
// Studio Light (Day 2): still one route, now laid out as three folding steps (Address → Payment →
// Review). A finished step folds into a one-line summary with "Change"; a returning buyer with a
// saved address lands straight on Review. "Continue" is ink; "Place order" is the one persimmon.
// The order, Stripe and Idempotency-Key logic below is unchanged from the earlier build.
export function CheckoutPage() {
  const { t } = useTranslation(['cart']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: cart, isPending: cartPending } = useQuery({ queryKey: CART_QUERY_KEY, queryFn: getCart });
  const { data: addresses, isPending: addressesPending } = useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: listAddresses,
  });
  const { data: paymentConfig } = useQuery({ queryKey: ['payments', 'config'], queryFn: getPaymentConfig });

  const [addressId, setAddressId] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  // null until the buyer moves; then the step they chose. Returning buyers start on Review.
  const [stepChoice, setStepChoice] = useState<Step | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stripeOrders, setStripeOrders] = useState<CreatedOrderDTO[]>([]);
  const [stripeAddress, setStripeAddress] = useState<AddressDTO | null>(null);
  const [stripePaymentPending, setStripePaymentPending] = useState(false);
  const [stripeOrderIndex, setStripeOrderIndex] = useState(0);
  const [checkingStripeStatus, setCheckingStripeStatus] = useState(false);
  const [stripeStatusMessage, setStripeStatusMessage] = useState<string | null>(null);
  // Persist the request key before sending checkout. A lost HTTP response can leave a real
  // pending order even though the browser never received a client secret.
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const nextAttemptNeedsFreshKey = useRef(false);

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_STRIPE_CHECKOUT_KEY);
    if (!pending) return;
    try {
      const saved = JSON.parse(pending) as { idempotencyKey?: string; orders?: CreatedOrderDTO[]; address?: AddressDTO | null; paymentPending?: boolean };
      if (typeof saved.idempotencyKey === 'string' && saved.idempotencyKey.length > 0 && saved.idempotencyKey.length <= 64) {
        idempotencyKey.current = saved.idempotencyKey;
      }
      if (Array.isArray(saved.orders) && saved.orders.length > 0) {
        setStripeOrders(saved.orders);
        setStripeAddress(saved.address ?? null);
        // Older saved checkouts have no marker. Treat them as uncertain until the order is
        // checked; showing Pay again could repeat a confirmation whose browser response was lost.
        if (saved.paymentPending !== false) {
          setStripePaymentPending(true);
          setStripeStatusMessage(t('checkout.paymentPending'));
        }
      }
    } catch {
      sessionStorage.removeItem(PENDING_STRIPE_CHECKOUT_KEY);
    }
  }, []);

  // Generated once per mount and reused across retries of the *same* checkout attempt — a
  // resubmit after a timeout must send the identical key so the backend returns the original
  // result instead of creating a second order set (F6-cart-checkout-backend.md's idempotency
  // contract).
  const selectedAddress = addresses?.find((a) => a.id === addressId) ?? addresses?.find((a) => a.isDefault) ?? addresses?.[0];
  const effectiveAddressId = selectedAddress?.id;

  const eligibleGroups = cart?.sellerGroups.filter((g) => g.eligibleForCheckout) ?? [];
  const grandSubtotal = eligibleGroups.reduce((sum, group) => sum + Number(group.subtotal), 0);

  async function handlePlaceOrder() {
    if (!effectiveAddressId || submitting) return;
    if (nextAttemptNeedsFreshKey.current) {
      idempotencyKey.current = crypto.randomUUID();
      nextAttemptNeedsFreshKey.current = false;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (paymentMethod === 'STRIPE') {
        sessionStorage.setItem(PENDING_STRIPE_CHECKOUT_KEY, JSON.stringify({
          idempotencyKey: idempotencyKey.current, orders: [], address: selectedAddress ?? null, paymentPending: false,
        }));
      }
      const result = await checkout({ addressId: effectiveAddressId, paymentMethod }, idempotencyKey.current);

      if (paymentMethod === 'STRIPE') {
        if (result.orders.length > 0 && result.orders.every((order) => order.status === 'PAYMENT_CONFIRMED' && order.paymentStatus === 'CONFIRMED')) {
          await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
          navigate('/checkout/confirmation', { state: { orders: result.orders, address: selectedAddress ?? null } });
          setSubmitting(false);
          return;
        }
        if (!result.orders.length || result.orders.some((order) => !order.paymentClientSecret)) {
          setSubmitError(t('checkout.paymentNotConfirmed'));
          setSubmitting(false);
          return;
        }
        await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        setStripeOrders(result.orders);
        setStripePaymentPending(false);
        setStripeOrderIndex(0);
        setStripeAddress(selectedAddress ?? null);
        sessionStorage.setItem(PENDING_STRIPE_CHECKOUT_KEY, JSON.stringify({
          idempotencyKey: idempotencyKey.current, orders: result.orders, address: selectedAddress ?? null, paymentPending: false,
        }));
        setSubmitting(false);
        return;
      }

      // COD orders intentionally retain PaymentStatus.PENDING until the cash is collected at delivery.
      await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      // The address is passed through so the confirmation screen can show a delivery recap
      // without a second fetch — CreatedOrderDTO itself carries no shipping fields.
      navigate('/checkout/confirmation', { state: { orders: result.orders, address: selectedAddress ?? null } });
    } catch (err) {
      // Keep the key for network/ambiguous outcomes so the server can reconcile the same Stripe
      // PaymentIntent. Rotate only after the backend confirms this attempt is terminal.
      if (err instanceof ApiError && err.code === 'PAYMENT_ATTEMPT_FAILED') {
        nextAttemptNeedsFreshKey.current = true;
        sessionStorage.removeItem(PENDING_STRIPE_CHECKOUT_KEY);
      }
      setSubmitError(formatCartError(t, err));
      setSubmitting(false);
    }
  }

  async function verifyStripeOrder(orderIndex: number) {
    const order = stripeOrders[orderIndex];
    if (!order || checkingStripeStatus) return;
    setCheckingStripeStatus(true);
    setStripeStatusMessage(null);
    try {
      for (let attempt = 0; attempt < 25; attempt++) {
        // A signed webhook may be missed if the local CLI listener was offline. After the
        // ordinary polling window, ask the server to check the same intent and real event
        // through Stripe's authenticated API. The browser never supplies a payment result.
        const authoritative = attempt === 24
          ? await reconcileOrderPayment(order.id).catch(() => getOrderPaymentStatus(order.id))
          : await getOrderPaymentStatus(order.id);
        if (authoritative.paymentStatus === 'CONFIRMED' && authoritative.status === 'PAYMENT_CONFIRMED') {
          const updatedOrders = stripeOrders.map((item, index) => index === orderIndex
            ? { ...item, status: authoritative.status, paymentStatus: authoritative.paymentStatus }
            : item);
          setStripeOrders(updatedOrders);
          if (orderIndex + 1 < updatedOrders.length) {
            setStripePaymentPending(false);
            sessionStorage.setItem(PENDING_STRIPE_CHECKOUT_KEY, JSON.stringify({
              idempotencyKey: idempotencyKey.current, orders: updatedOrders, address: stripeAddress, paymentPending: false,
            }));
            setStripeOrderIndex(orderIndex + 1);
            return;
          }
          sessionStorage.removeItem(PENDING_STRIPE_CHECKOUT_KEY);
          navigate('/checkout/confirmation', { state: { orders: updatedOrders, address: stripeAddress ?? selectedAddress ?? null } });
          return;
        }
        if (authoritative.status === 'CANCELLED' || authoritative.paymentStatus === 'CANCELLED' || authoritative.paymentStatus === 'FAILED') {
          sessionStorage.removeItem(PENDING_STRIPE_CHECKOUT_KEY);
          setStripeOrders([]);
          setStripePaymentPending(false);
          setStripeStatusMessage(t('checkout.paymentCanceled'));
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setStripeStatusMessage(t('checkout.paymentPending'));
    } catch {
      setStripeStatusMessage(t('checkout.paymentPending'));
    } finally {
      setCheckingStripeStatus(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (stripeOrders.length > 0 && params.has('payment_intent')) {
      window.history.replaceState({}, '', window.location.pathname);
      void verifyStripeOrder(stripeOrderIndex);
    }
  }, [stripeOrders.length, stripeOrderIndex]);

  if (cartPending || addressesPending) {
    return (
      <div className="checkout" aria-busy="true">
        <Skeleton height={44} width={220} style={{ display: 'block' }} />
        <div className="checkout__layout">
          <div>
            <Skeleton height={120} radius="24px" style={{ display: 'block', marginBlockEnd: 12 }} />
            <Skeleton height={80} radius="24px" style={{ display: 'block', marginBlockEnd: 12 }} />
            <Skeleton height={80} radius="24px" style={{ display: 'block' }} />
          </div>
          <Skeleton height={260} radius="24px" style={{ display: 'block' }} />
        </div>
      </div>
    );
  }

  if (eligibleGroups.length === 0 && stripeOrders.length === 0) {
    return (
      <div className="pdp-missing">
        <EmptyState
          headingLevel={1}
          title={t('flow.nothingReadyTitle')}
          description={t('flow.nothingReadyBody')}
          actionLabel={t('flow.backToCart')}
          onAction={() => navigate('/cart')}
        />
      </div>
    );
  }

  const hasAddress = !!effectiveAddressId;
  // A buyer with no address must start at step 1; nobody can jump past it without one.
  const step: Step = !hasAddress ? 1 : stepChoice ?? 3;
  const itemCount = eligibleGroups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.quantity, 0), 0);
  const methodLabel = (method: PaymentMethod) =>
    t(`checkout.${method === 'COD' ? 'cod' : method === 'STRIPE' ? 'stripe' : method.toLowerCase()}`);
  const stepNames: Record<Step, string> = { 1: t('flow.stepAddress'), 2: t('flow.stepPayment'), 3: t('flow.stepReview') };

  function stepHead(n: Step, done: boolean, summary?: string) {
    const open = step === n;
    return (
      <header className="co-step__head">
        <span className="co-step__num" data-state={open ? 'current' : done ? 'done' : 'todo'} aria-hidden="true">
          {done && !open ? <Check size={16} strokeWidth={2.6} /> : n}
        </span>
        <div className="co-step__titles">
          <h2 className="co-step__title" id={`co-step-${n}`}>
            {stepNames[n]}
          </h2>
          {!open && summary && (
            <p className="co-step__summary" dir="auto">
              {summary}
            </p>
          )}
        </div>
        {!open && done && stripeOrders.length === 0 && (
          <button type="button" className="co-step__change" onClick={() => setStepChoice(n)}>
            {t('flow.change')}
            <span className="sr-only"> {stepNames[n]}</span>
          </button>
        )}
      </header>
    );
  }

  return (
    <div className="checkout">
      <header className="checkout__head">
        <h1 className="checkout__title">{t('checkout.title')}</h1>
        <ol className="co-steps" aria-label={t('flow.stepsLabel')}>
          {([1, 2, 3] as Step[]).map((n) => {
            const done = n < step || (n === 1 && hasAddress && step !== 1);
            return (
              <li key={n} className="co-steps__item" data-state={step === n ? 'current' : done ? 'done' : 'todo'} aria-current={step === n ? 'step' : undefined}>
                <span className="co-steps__dot" aria-hidden="true">
                  {done ? <Check size={14} strokeWidth={2.8} /> : n}
                </span>
                {stepNames[n]}
              </li>
            );
          })}
        </ol>
      </header>

      <div className="checkout__layout">
        <div className="checkout__steps">
          {/* 1 · Address */}
          <section className="co-step" data-open={step === 1 || undefined} aria-labelledby="co-step-1">
            {stepHead(1, hasAddress, selectedAddress ? `${selectedAddress.recipientName}, ${formatAddress(selectedAddress)}` : undefined)}
            {step === 1 && (
              <div className="co-step__body">
                {!hasAddress && <p className="co-step__hint">{t('flow.addAddressFirst')}</p>}
                <AddressPicker
                  addresses={addresses ?? []}
                  value={effectiveAddressId}
                  onChange={setAddressId}
                  onAddressCreated={(address: AddressDTO) => {
                    queryClient.setQueryData(ADDRESSES_QUERY_KEY, [...(addresses ?? []), address]);
                    setAddressId(address.id);
                  }}
                />
                <div className="co-step__actions">
                  <Button variant="secondary" disabled={!hasAddress} onClick={() => setStepChoice(2)}>
                    {t('flow.continue')}
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* 2 · Payment */}
          <section className="co-step" data-open={step === 2 || undefined} aria-labelledby="co-step-2">
            {stepHead(2, hasAddress && step === 3, methodLabel(paymentMethod))}
            {step === 2 && (
              <div className="co-step__body">
                <div className="pay-options" role="radiogroup" aria-labelledby="co-step-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = PAYMENT_METHOD_ICON[method];
                    const localUnavailable = method === 'JAZZCASH' || method === 'EASYPAISA';
                    const unavailable = localUnavailable || (method === 'STRIPE' && !paymentConfig?.stripeEnabled);
                    const sub = method === 'COD' ? t('flow.codSub') : method === 'STRIPE' ? (unavailable ? t('checkout.stripeUnavailable') : t('flow.stripeSub')) : t('flow.walletSub');
                    return (
                      <label key={method} className="pay-option" data-selected={paymentMethod === method || undefined} data-disabled={unavailable || undefined}>
                        <input
                          type="radio"
                          name="payment-method"
                          value={method}
                          checked={paymentMethod === method}
                          disabled={unavailable}
                          onChange={() => setPaymentMethod(method)}
                        />
                        <span className={`pay-option__icon pay-option__icon--${method.toLowerCase()}`}>
                          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <span className="pay-option__text">
                          <strong>{methodLabel(method)}</strong>
                          <small>{sub}</small>
                        </span>
                        {unavailable ? (
                          <span className="pay-option__tag">{t('flow.notAvailable')}</span>
                        ) : (
                          <span className="pay-option__check" aria-hidden="true">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="co-step__secure">
                  <ShieldCheck size={16} strokeWidth={1.8} aria-hidden="true" />
                  {t('checkout.secureNote')}
                </p>
                <div className="co-step__actions">
                  <Button variant="secondary" onClick={() => setStepChoice(3)}>
                    {t('flow.continue')}
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* 3 · Review */}
          <section className="co-step" data-open={step === 3 || undefined} aria-labelledby="co-step-3">
            {stepHead(3, false)}
            {step === 3 && (
              <div className="co-step__body">
                <p className="co-step__hint">{t('flow.reviewNote')}</p>
                {eligibleGroups.map((group) => (
                  <div key={group.sellerId} className="co-store">
                    <div className="co-store__head">
                      <StoreMonogram name={group.storeName} size={32} />
                      <strong dir="auto">{group.storeName}</strong>
                    </div>
                    <ul className="co-store__items">
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <span className="co-store__thumb">
                            <ProductThumbnail src={item.primaryImageUrl} fill radius="sm" style={{ background: 'transparent' }} />
                          </span>
                          <span className="co-store__name">
                            {item.titleEn}
                            <small>{t('flow.qty', { count: item.quantity })}</small>
                          </span>
                          <PriceDisplay amount={Number(item.price) * item.quantity} strong />
                        </li>
                      ))}
                    </ul>
                    <div className="co-store__foot">
                      <span>{t('flow.storeShipping')}</span>
                      <span>
                        {t('sellerGroup.subtotal')} <PriceDisplay amount={group.subtotal} strong />
                      </span>
                    </div>
                  </div>
                ))}
                <div className="co-store__edit">
                  <Link to="/cart">{t('checkout.editCart')}</Link>
                </div>
              </div>
            )}
          </section>

          {stripeOrders[stripeOrderIndex] && (
            <section className="co-step co-step--pay" data-open>
              <header className="co-step__head">
                <span className="co-step__num" data-state="current" aria-hidden="true">
                  <CreditCard size={16} />
                </span>
                <div className="co-step__titles">
                  <h2 className="co-step__title">{t('checkout.stripePaymentTitle')}</h2>
                </div>
              </header>
              <div className="co-step__body">
                {stripeOrders[stripeOrderIndex]?.paymentAmountUsd && (
                  <p className="co-step__strong">{t('checkout.stripeChargeAmount', { amount: stripeOrders[stripeOrderIndex]!.paymentAmountUsd })}</p>
                )}
                <p className="co-step__hint">{t('checkout.stripeCurrencyNote')}</p>
                {stripeStatusMessage && <Alert type="warning" showIcon message={stripeStatusMessage} style={{ marginBottom: 12 }} />}
                {stripeOrders[stripeOrderIndex]?.paymentClientSecret && paymentConfig?.stripePublishableKey && (
                  <StripePaymentForm
                    key={stripeOrders[stripeOrderIndex]!.id}
                    publishableKey={paymentConfig.stripePublishableKey}
                    clientSecret={stripeOrders[stripeOrderIndex]!.paymentClientSecret!}
                    submitLabel={t('checkout.payNow')}
                    pendingLabel={t('checkout.paymentPending')}
                    initiallySubmitted={stripePaymentPending}
                    onAttemptStarted={() => {
                      setStripePaymentPending(true);
                      sessionStorage.setItem(PENDING_STRIPE_CHECKOUT_KEY, JSON.stringify({
                        idempotencyKey: idempotencyKey.current, orders: stripeOrders, address: stripeAddress, paymentPending: true,
                      }));
                    }}
                    onAttemptFailed={() => {
                      setStripePaymentPending(false);
                      sessionStorage.setItem(PENDING_STRIPE_CHECKOUT_KEY, JSON.stringify({
                        idempotencyKey: idempotencyKey.current, orders: stripeOrders, address: stripeAddress, paymentPending: false,
                      }));
                    }}
                    onSubmitted={() => void verifyStripeOrder(stripeOrderIndex)}
                  />
                )}
                {stripeStatusMessage && !checkingStripeStatus && (
                  <div className="co-step__actions">
                    <Button variant="outline" loading={checkingStripeStatus} onClick={() => void verifyStripeOrder(stripeOrderIndex)}>
                      {t('checkout.checkPaymentStatus')}
                    </Button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="cart-summary checkout-summary" aria-labelledby="co-summary-title">
          <h2 id="co-summary-title" className="cart-summary__title">
            {t('flow.summaryTitle')}
          </h2>
          <dl className="cart-summary__lines">
            <div>
              <dt>
                {t('flow.itemsLine')} <span className="cart-summary__muted">({itemCount})</span>
              </dt>
              <dd>
                <PriceDisplay amount={grandSubtotal} />
              </dd>
            </div>
            <div>
              <dt>{t('flow.shippingLine')}</dt>
              <dd className="cart-summary__muted">{t('flow.shippingValue')}</dd>
            </div>
            {selectedAddress && (
              <div className="cart-summary__stack">
                <dt>{t('flow.deliverTo')}</dt>
                <dd>{`${selectedAddress.recipientName}, ${selectedAddress.city}`}</dd>
              </div>
            )}
            <div>
              <dt>{t('flow.payWith')}</dt>
              <dd>{methodLabel(paymentMethod)}</dd>
            </div>
          </dl>
          <div className="cart-summary__total">
            <span>{t('flow.totalBeforeShipping')}</span>
            <PriceDisplay amount={grandSubtotal} size="lg" strong />
          </div>
          {submitError && (
            <div role="alert" className="checkout-summary__error">
              {submitError}
            </div>
          )}
          <Button
            size="lg"
            fullWidth
            disabled={!effectiveAddressId || eligibleGroups.length === 0 || stripeOrders.length > 0 || step !== 3}
            loading={submitting}
            onClick={handlePlaceOrder}
          >
            {submitting ? t(paymentMethod === 'COD' ? 'checkout.processing' : 'checkout.confirmingPayment') : t('checkout.placeOrder')}
          </Button>
          {paymentMethod === 'COD' && (
            <p className="cart-summary__cod">
              <Banknote size={18} strokeWidth={1.8} aria-hidden="true" />
              {t('flow.codNote')}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
