import { useRef, useState } from 'react';
import { Alert, Button, Card, Divider, Radio, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Banknote, ShieldCheck, Smartphone } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import type { AddressDTO, PaymentMethod } from '@karobarai/shared';
import { PriceDisplay, ProductThumbnail, SkeletonLoader } from '../../components';
import { AddressPicker } from './AddressPicker';
import { SelectableOptionCard } from './SelectableOptionCard';
import { ADDRESSES_QUERY_KEY, CART_QUERY_KEY, checkout, getCart, listAddresses } from './cartApi';
import { formatCartError } from './cartErrors';

const PAYMENT_METHODS: PaymentMethod[] = ['COD', 'JAZZCASH', 'EASYPAISA'];
const PAYMENT_METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  COD: Banknote,
  JAZZCASH: Smartphone,
  EASYPAISA: Smartphone,
};

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

  const [addressId, setAddressId] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Generated once per mount and reused across retries of the *same* checkout attempt — a
  // resubmit after a timeout must send the identical key so the backend returns the original
  // result instead of creating a second order set (F6-cart-checkout-backend.md's idempotency
  // contract).
  const idempotencyKey = useRef(crypto.randomUUID());

  const selectedAddress = addresses?.find((a) => a.id === addressId) ?? addresses?.find((a) => a.isDefault) ?? addresses?.[0];
  const effectiveAddressId = selectedAddress?.id;

  const eligibleGroups = cart?.sellerGroups.filter((g) => g.eligibleForCheckout) ?? [];
  const grandSubtotal = eligibleGroups.reduce((sum, group) => sum + Number(group.subtotal), 0);

  async function handlePlaceOrder() {
    if (!effectiveAddressId || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await checkout({ addressId: effectiveAddressId, paymentMethod }, idempotencyKey.current);

      // F-payment-confirmation-gap-closure.md's exact contract: COD orders correctly come back
      // with paymentStatus "PENDING" (cash isn't collected until delivery) — that's not an error.
      // Online-payment orders (JazzCash/Easypaisa) are confirmed synchronously inside the same
      // checkout request, so by the time this response lands every order should already be
      // CONFIRMED; the rare case where confirmation itself failed after order creation must not
      // silently proceed to the confirmation screen.
      if (paymentMethod !== 'COD') {
        const unconfirmed = result.orders.some((order) => order.paymentStatus !== 'CONFIRMED');
        if (unconfirmed) {
          setSubmitError(t('checkout.paymentNotConfirmed'));
          setSubmitting(false);
          return;
        }
      }

      await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      // The address is passed through so the confirmation screen can show a delivery recap
      // without a second fetch — CreatedOrderDTO itself carries no shipping fields.
      navigate('/checkout/confirmation', { state: { orders: result.orders, address: selectedAddress ?? null } });
    } catch (err) {
      setSubmitError(formatCartError(t, err));
      setSubmitting(false);
    }
  }

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
            return (
              <SelectableOptionCard key={method} selected={paymentMethod === method}>
                <Radio value={method} style={{ width: '100%' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    {t(`checkout.${method === 'COD' ? 'cod' : method.toLowerCase()}`)}
                  </span>
                </Radio>
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
        disabled={!effectiveAddressId || eligibleGroups.length === 0}
        loading={submitting}
        onClick={handlePlaceOrder}
      >
        {submitting ? t(paymentMethod === 'COD' ? 'checkout.processing' : 'checkout.confirmingPayment') : t('checkout.placeOrder')}
      </Button>
    </div>
  );
}
