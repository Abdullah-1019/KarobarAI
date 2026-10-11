import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Divider, Radio, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Banknote, CreditCard, ShieldCheck, Smartphone } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import type { AddressDTO, CreatedOrderDTO, PaymentMethod } from '@karobarai/shared';
import { ApiError } from '../../api';
import { PriceDisplay, ProductThumbnail, SkeletonLoader } from '../../components';
import { AddressPicker } from './AddressPicker';
import { SelectableOptionCard } from './SelectableOptionCard';
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

const PENDING_STRIPE_CHECKOUT_KEY = 'karobarai.pending-stripe-checkout';

// SCR-B05 — commission is intentionally never rendered here; the backend already omits it from
// every buyer-facing cart/order response, so there's nothing to filter client-side.
//
// This is one single-page checkout, not three separate step screens — the E3 brief's "Delivery
// Information" / "Order Review" / "Payment" map onto three Card-separated sections on this same
// page/route rather than a new multi-step wizard, preserving the existing architecture.
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
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-5)' }}>
        {t('checkout.title')}
      </Typography.Title>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 'var(--sp-4)' }} />}

      <Card title={t('address.title')}>
        <AddressPicker
          addresses={addresses ?? []}
          value={effectiveAddressId}
          onChange={setAddressId}
          onAddressCreated={(address: AddressDTO) => {
            queryClient.setQueryData(ADDRESSES_QUERY_KEY, [...(addresses ?? []), address]);
            setAddressId(address.id);
          }}
        />
      </Card>

      <Card title={t('checkout.paymentMethod')} style={{ marginTop: 'var(--sp-4)' }}>
        <Radio.Group
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', width: '100%' }}
        >
          {PAYMENT_METHODS.map((method) => {
            const Icon = PAYMENT_METHOD_ICON[method];
            const localUnavailable = method === 'JAZZCASH' || method === 'EASYPAISA';
            const unavailable = localUnavailable || (method === 'STRIPE' && !paymentConfig?.stripeEnabled);
            return (
              <SelectableOptionCard key={method} selected={paymentMethod === method}>
                <Radio value={method} disabled={unavailable} style={{ width: '100%' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    {t(`checkout.${method === 'COD' ? 'cod' : method === 'STRIPE' ? 'stripe' : method.toLowerCase()}`)}
                  </span>
                </Radio>
                {unavailable && (
                  <Typography.Text type="secondary" style={{ display: 'block', marginLeft: 24, fontSize: 'var(--fs-xs)' }}>
                    {t(localUnavailable ? 'checkout.localGatewayUnavailable' : 'checkout.stripeUnavailable')}
                  </Typography.Text>
                )}
              </SelectableOptionCard>
            );
          })}
        </Radio.Group>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
          <ShieldCheck size={16} strokeWidth={1.75} color="var(--text-secondary)" aria-hidden="true" />
          <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
            {t('checkout.secureNote')}
          </Typography.Text>
        </div>
      </Card>

      {stripeOrders[stripeOrderIndex] && (
        <Card title={t('checkout.stripePaymentTitle')} style={{ marginTop: 'var(--sp-4)' }}>
          {stripeOrders[stripeOrderIndex]?.paymentAmountUsd && (
            <Typography.Paragraph strong>
              {t('checkout.stripeChargeAmount', { amount: stripeOrders[stripeOrderIndex]!.paymentAmountUsd })}
            </Typography.Paragraph>
          )}
          <Typography.Paragraph>{t('checkout.stripeCurrencyNote')}</Typography.Paragraph>
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
            <Button style={{ marginTop: 12 }} loading={checkingStripeStatus} onClick={() => void verifyStripeOrder(stripeOrderIndex)}>
              {t('checkout.checkPaymentStatus')}
            </Button>
          )}
        </Card>
      )}

      <Card
        title={t('checkout.orderSummary')}
        extra={
          <Link to="/cart" style={{ fontSize: 'var(--fs-sm)' }}>
            {t('checkout.editCart')}
          </Link>
        }
        style={{ marginTop: 'var(--sp-4)' }}
      >
        {eligibleGroups.map((group, groupIndex) => (
          <div key={group.sellerId} style={{ marginTop: groupIndex === 0 ? 0 : 'var(--sp-4)' }}>
            <Typography.Text strong>{group.storeName}</Typography.Text>
            {group.items.map((item) => (
              <div
                key={item.id}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}
              >
                <ProductThumbnail src={item.primaryImageUrl} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Text ellipsis style={{ display: 'block', fontSize: 'var(--fs-sm)' }}>
                    {item.titleEn}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
                    × {item.quantity}
                  </Typography.Text>
                </div>
                <PriceDisplay amount={Number(item.price) * item.quantity} size="sm" />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--sp-2)' }}>
              <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-sm)' }}>
                {t('sellerGroup.subtotal')}
              </Typography.Text>
              <PriceDisplay amount={group.subtotal} size="sm" muted />
            </div>
            {groupIndex < eligibleGroups.length - 1 && <Divider style={{ margin: 'var(--sp-3) 0' }} />}
          </div>
        ))}

        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 'var(--sp-4)', fontSize: 'var(--fs-xs)' }}>
          {t('page.shippingNote')}
        </Typography.Text>

        <Divider style={{ margin: 'var(--sp-3) 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography.Text strong>{t('page.grandTotal')}</Typography.Text>
          <PriceDisplay amount={grandSubtotal} size="lg" />
        </div>
      </Card>

      <Button
        type="primary"
        size="large"
        block
        style={{ marginTop: 'var(--sp-6)' }}
        disabled={!effectiveAddressId || eligibleGroups.length === 0 || stripeOrders.length > 0}
        loading={submitting}
        onClick={handlePlaceOrder}
      >
        {submitting ? t(paymentMethod === 'COD' ? 'checkout.processing' : 'checkout.confirmingPayment') : t('checkout.placeOrder')}
      </Button>
    </div>
  );
}
