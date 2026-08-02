import { useRef, useState } from 'react';
import { Alert, Button, Card, Radio, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { AddressDTO, PaymentMethod } from '@karobarai/shared';
import { SkeletonLoader } from '../../components';
import { AddressPicker } from './AddressPicker';
import { ADDRESSES_QUERY_KEY, CART_QUERY_KEY, checkout, getCart, listAddresses } from './cartApi';
import { formatCartError } from './cartErrors';

const PAYMENT_METHODS: PaymentMethod[] = ['COD', 'JAZZCASH', 'EASYPAISA'];

// SCR-B05 — commission is intentionally never rendered here; the backend already omits it from
// every buyer-facing cart/order response, so there's nothing to filter client-side.
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

  const effectiveAddressId = addressId ?? addresses?.find((a) => a.isDefault)?.id ?? addresses?.[0]?.id;

  const eligibleGroups = cart?.sellerGroups.filter((g) => g.eligibleForCheckout) ?? [];

  async function handlePlaceOrder() {
    if (!effectiveAddressId || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await checkout({ addressId: effectiveAddressId, paymentMethod }, idempotencyKey.current);
      await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      navigate('/checkout/confirmation', { state: { orders: result.orders } });
    } catch (err) {
      setSubmitError(formatCartError(t, err));
      setSubmitting(false);
    }
  }

  if (cartPending || addressesPending) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('checkout.title')}</Typography.Title>

      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

      <AddressPicker
        addresses={addresses ?? []}
        value={effectiveAddressId}
        onChange={setAddressId}
        onAddressCreated={(address: AddressDTO) => {
          queryClient.setQueryData(ADDRESSES_QUERY_KEY, [...(addresses ?? []), address]);
          setAddressId(address.id);
        }}
      />

      <div style={{ marginTop: 24 }}>
        <Typography.Text strong>{t('checkout.paymentMethod')}</Typography.Text>
        <Radio.Group
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}
        >
          {PAYMENT_METHODS.map((method) => (
            <Radio key={method} value={method}>
              {t(`checkout.${method === 'COD' ? 'cod' : method.toLowerCase()}`)}
            </Radio>
          ))}
        </Radio.Group>
      </div>

      <div style={{ marginTop: 24 }}>
        <Typography.Text strong>{t('checkout.orderSummary')}</Typography.Text>
        {eligibleGroups.map((group) => (
          <Card key={group.sellerId} size="small" style={{ marginTop: 8 }}>
            <Typography.Text strong>{group.storeName}</Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('checkout.orderSummary')}</span>
              <span>Rs. {Number(group.subtotal).toLocaleString()}</span>
            </div>
          </Card>
        ))}
      </div>

      <Button
        type="primary"
        size="large"
        block
        style={{ marginTop: 24 }}
        disabled={!effectiveAddressId || eligibleGroups.length === 0}
        loading={submitting}
        onClick={handlePlaceOrder}
      >
        {submitting ? t('checkout.processing') : t('checkout.placeOrder')}
      </Button>
    </div>
  );
}
