import { useEffect } from 'react';
import { Button, Card, Divider, Typography } from 'antd';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import type { AddressDTO, CreatedOrderDTO } from '@karobarai/shared';
import { PriceDisplay } from '../../components';

interface ConfirmationState {
  orders: CreatedOrderDTO[];
  address: AddressDTO | null;
}

// SCR-B06 — success-only screen. Deliberately has no `:id` in its route: one checkout call can
// create N orders (one per seller group), so there's no single id to key a re-fetchable route on.
// A direct visit/refresh with no location.state redirects home instead of guessing.
//
// E3: reassuring rather than celebratory (UIUX brief) — a single brand-green check, no confetti/
// emoji. The address recap uses `address` passed through CheckoutPage's navigate() call rather
// than a new fetch — CreatedOrderDTO itself carries no shipping fields, and re-fetching each
// order's full detail just to show the address it was already placed with would be wasted calls.
export function CheckoutConfirmationPage() {
  const { t } = useTranslation(['cart']);
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ConfirmationState | null;

  useEffect(() => {
    if (!state?.orders?.length) {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (!state?.orders?.length) {
    return null;
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
        <CheckCircle2 size={40} strokeWidth={1.5} color="var(--success)" aria-hidden="true" />
        <Typography.Title level={3} style={{ marginTop: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
          {t('confirmation.title')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('confirmation.whatNext')}</Typography.Text>
      </div>

      {state.address && (
        <Card size="small" style={{ marginBottom: 'var(--sp-4)' }}>
          <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
            {t('confirmation.deliveringTo')}
          </Typography.Text>
          <div>
            <Typography.Text strong>{state.address.recipientName}</Typography.Text>
            <div>
              {state.address.line1}
              {state.address.line2 ? `, ${state.address.line2}` : ''}, {state.address.city}, {state.address.province}
            </div>
          </div>
        </Card>
      )}

      {state.orders.map((order) => (
        <Card key={order.id} style={{ marginBottom: 'var(--sp-4)' }} title={t('confirmation.orderNumber', { id: order.id })}>
          <Typography.Text strong>{order.storeName}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
            {t('confirmation.itemCount', { count: order.items.length })}
          </Typography.Text>

          <div style={{ marginTop: 'var(--sp-3)' }}>
            {order.items.map((item) => (
              <div
                key={item.productId}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: 'var(--sp-1) 0' }}
              >
                <Typography.Text style={{ fontSize: 'var(--fs-sm)' }}>
                  {item.titleSnapshot} × {item.quantity}
                </Typography.Text>
                <PriceDisplay amount={Number(item.unitPrice) * item.quantity} size="sm" muted />
              </div>
            ))}
          </div>

          <Divider style={{ margin: 'var(--sp-3) 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-sm)' }}>
              {t('confirmation.subtotal')}
            </Typography.Text>
            <PriceDisplay amount={order.subtotal} size="sm" muted />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--sp-1)' }}>
            <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-sm)' }}>
              {t('checkout.shippingFee')}
            </Typography.Text>
            <PriceDisplay amount={order.shippingFee} size="sm" muted />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--sp-2)' }}>
            <Typography.Text strong>{t('confirmation.total')}</Typography.Text>
            <PriceDisplay amount={order.totalAmount} />
          </div>
        </Card>
      ))}

      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
        <Link to="/orders" style={{ flex: 1 }}>
          <Button type="primary" size="large" block>
            {t('confirmation.viewOrders')}
          </Button>
        </Link>
        <Link to="/" style={{ flex: 1 }}>
          <Button size="large" block>
            {t('confirmation.continueShopping')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
