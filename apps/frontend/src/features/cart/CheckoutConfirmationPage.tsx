import { useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Check, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import type { AddressDTO, CreatedOrderDTO } from '@karobarai/shared';
import { Button, PriceDisplay } from '../../components';
import { useLanguage } from '../../hooks';
import { StoreMonogram } from '../marketplace/StoreMonogram';
import { getOrder, orderQueryKey } from '../orders/ordersApi';
import { formatAddress } from './addressFormat';

interface ConfirmationState {
  orders: CreatedOrderDTO[];
  address: AddressDTO | null;
}

const PKR = new Intl.NumberFormat('en-PK');

// Twelve small pieces thrown once from behind the check: angle (deg), distance (px), shape, tone.
const BURST = Array.from({ length: 12 }, (_, i) => ({
  a: i * 30 + (i % 2 ? 9 : -6),
  d: 92 + (i % 3) * 22,
  shape: i % 3 === 0 ? 'bar' : 'dot',
  tone: ['persimmon', 'indigo', 'peach', 'ink'][i % 4],
}));

// SCR-B06, Studio Light (Day 2). The page's one signature moment is the celebration: an ink check
// stamps onto a peach band while a ring ripples out and a handful of small pieces are thrown once
// (transform/opacity only, ~900ms, never looping); reduced motion shows the settled check with no
// pieces. "Shukriya!" leads, with its Nastaliq twin. Order numbers are the real ones: the checkout
// response only carries UUIDs, so each order's detail is fetched for its number (a UUID prefix
// shows until it arrives). A direct visit with no checkout state goes home, as before.
export function CheckoutConfirmationPage() {
  const { t } = useTranslation(['cart']);
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const state = location.state as ConfirmationState | null;
  const orders = state?.orders ?? [];

  const details = useQueries({
    queries: orders.map((order) => ({ queryKey: orderQueryKey(order.id), queryFn: () => getOrder(order.id), staleTime: 60_000 })),
  });

  useEffect(() => {
    if (!state?.orders?.length) {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (!orders.length) return null;

  const isCod = orders.every((o) => o.paymentMethod === 'COD');
  const grandTotal = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const single = orders.length === 1 ? orders[0] : null;
  const numberFor = (index: number, order: CreatedOrderDTO) => {
    const n = details[index]?.data?.orderNumber;
    return n ? String(n) : order.id.slice(0, 8).toUpperCase();
  };

  return (
    <div className="confirm">
      <section className="confirm-band" aria-labelledby="confirm-title">
        <div className="confirm-mark" aria-hidden="true">
          <span className="confirm-mark__ring" />
          {BURST.map((p, i) => (
            <i
              key={i}
              className={`confirm-mark__bit confirm-mark__bit--${p.shape} confirm-mark__bit--${p.tone}`}
              style={{ ['--a' as string]: `${p.a}deg`, ['--d' as string]: `${p.d}px`, ['--i' as string]: i }}
            />
          ))}
          <span className="confirm-mark__disc">
            <Check size={44} strokeWidth={2.6} />
          </span>
        </div>
        <h1 id="confirm-title" className="confirm-band__title">
          {t('flow.thanks')}
        </h1>
        <p className="confirm-band__twin" lang={language === 'UR' ? 'en' : 'ur'} dir={language === 'UR' ? 'ltr' : 'rtl'}>
          {t('flow.thanksTwin')}
        </p>
        <p className="confirm-band__lead">{single ? t('flow.placedOne') : t('flow.placedMany', { count: orders.length })}</p>
        <p className="confirm-band__pay">{isCod ? t('flow.codPay', { amount: `Rs. ${PKR.format(grandTotal)}` }) : t('flow.paidCard')}</p>
        <div className="confirm-band__actions">
          <Button size="lg" onClick={() => navigate(single ? `/orders/${single.id}/track` : '/orders')}>
            {single ? t('flow.trackOrder') : t('flow.trackOrders')}
          </Button>
          <Button size="lg" variant="outline" to="/">
            {t('flow.keepShopping')}
          </Button>
        </div>
      </section>

      <div className="confirm__layout">
        <div className="confirm__orders">
          {orders.map((order, index) => (
            <article key={order.id} className="confirm-order" aria-labelledby={`order-${order.id}`}>
              <header className="confirm-order__head">
                <StoreMonogram name={order.storeName} size={40} />
                <div>
                  <h2 id={`order-${order.id}`} className="confirm-order__no">
                    {t('flow.orderNo', { number: numberFor(index, order) })}
                  </h2>
                  <span className="confirm-order__store" dir="auto">
                    {order.storeName}
                  </span>
                </div>
              </header>
              <ul className="confirm-order__items">
                {order.items.map((item, index) => (
                  <li key={`${item.productId}-${index}`}>
                    <span>
                      {item.titleSnapshot}
                      <small>
                        {item.variantLabel ? `${item.variantLabel} · ` : ''}
                        {t('flow.qty', { count: item.quantity })}
                      </small>
                    </span>
                    <PriceDisplay amount={Number(item.unitPrice) * item.quantity} />
                  </li>
                ))}
              </ul>
              <dl className="confirm-order__sums">
                <div>
                  <dt>{t('confirmation.subtotal')}</dt>
                  <dd>
                    <PriceDisplay amount={order.subtotal} muted />
                  </dd>
                </div>
                <div>
                  <dt>{t('checkout.shippingFee')}</dt>
                  <dd>
                    <PriceDisplay amount={order.shippingFee} muted />
                  </dd>
                </div>
                <div className="confirm-order__total">
                  <dt>{t('confirmation.total')}</dt>
                  <dd>
                    <PriceDisplay amount={order.totalAmount} strong />
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <aside className="confirm__side">
          {state?.address && (
            <section className="confirm-card" aria-labelledby="confirm-addr">
              <h2 id="confirm-addr" className="confirm-card__title">
                <MapPin size={18} strokeWidth={1.8} aria-hidden="true" />
                {t('confirmation.deliveringTo')}
              </h2>
              <p className="confirm-card__name" dir="auto">
                {state.address.recipientName}
              </p>
              <p className="confirm-card__line" dir="auto">
                {formatAddress(state.address)}
              </p>
            </section>
          )}
          <section className="confirm-card" aria-labelledby="confirm-next">
            <h2 id="confirm-next" className="confirm-card__title">
              {t('flow.nextTitle')}
            </h2>
            <ol className="confirm-next">
              <li>{t('flow.next1')}</li>
              <li>{t('flow.next2')}</li>
              <li>{isCod ? t('flow.next3Cod') : t('flow.next3')}</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
