import { useEffect } from 'react';
import { Button, Card, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import type { CreatedOrderDTO } from '@karobarai/shared';
import { PriceDisplay } from '../../components';

interface ConfirmationState {
  orders: CreatedOrderDTO[];
}

// SCR-B06 — success-only screen. Deliberately has no `:id` in its route: one checkout call can
// create N orders (one per seller group), so there's no single id to key a re-fetchable route on.
// A direct visit/refresh with no location.state redirects home instead of guessing.
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
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-5)' }}>
        {t('confirmation.title')}
      </Typography.Title>

      {state.orders.map((order) => (
        <Card key={order.id} style={{ marginBottom: 'var(--sp-4)' }} title={t('confirmation.orderNumber', { id: order.id })}>
          <Typography.Text>{order.storeName}</Typography.Text>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'var(--sp-2)' }}>
            <Typography.Text type="secondary">{order.items.length} item(s)</Typography.Text>
            <PriceDisplay amount={order.totalAmount} />
          </div>
        </Card>
      ))}

      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
        <Link to="/orders">
          <Button type="primary">{t('confirmation.viewOrders')}</Button>
        </Link>
        <Link to="/">
          <Button>{t('confirmation.continueShopping')}</Button>
        </Link>
      </div>
    </div>
  );
}
