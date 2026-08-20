import { useState } from 'react';
import { Alert, Button, Card, Radio, Space, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { CourierCode } from '@karobarai/shared';
import { ApiError } from '../../api';
import { AIResultCard, AIStatus, Modal, PriceDisplay, RecommendationTier, StatusTag, toast } from '../../components';
import { orderQueryKey } from '../orders/ordersApi';
import { formatOrdersError } from '../orders/ordersErrors';
import {
  bookCourier,
  courierQuotesQueryKey,
  getCourierQuotes,
  refreshCourierRates,
  trackingQueryKey,
} from './trackingApi';

interface CourierRecommendationCardProps {
  orderId: string;
}

// E5 — the backend's courier score (tracking.service.ts's weighted cost/ETA/reliability/coverage
// formula) is a real number, but showing it as the headline reads as an unexplained decimal.
// Translated to a plain-language tier from the same score already returned, per the brief's own
// "Strong match / Worth a manual look" wording — not a fabricated explanation, just a human-
// readable read of real data. Thresholds are a presentational judgment call, not sourced from a
// backend contract (none exists for tiering).
function scoreTier(score: string): { level: 1 | 2 | 3; labelKey: 'courier.tierStrong' | 'courier.tierGood' | 'courier.tierConsider' } {
  const n = Number(score);
  if (n >= 0.7) return { level: 1, labelKey: 'courier.tierStrong' };
  if (n >= 0.4) return { level: 2, labelKey: 'courier.tierGood' };
  return { level: 3, labelKey: 'courier.tierConsider' };
}

// SCR-S06's recommendation card — populates Feature 7's reserved Order Detail placeholder with
// real, scored data (F8 module doc, Task 3.6). Only rendered by OrderDetailPage while the order
// is PAYMENT_CONFIRMED with no courier booked yet (Gap #4's eligibility rule).
export function CourierRecommendationCard({ orderId }: CourierRecommendationCardProps) {
  const { t } = useTranslation(['orders']);
  const queryClient = useQueryClient();
  const [selectedCourier, setSelectedCourier] = useState<CourierCode | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);

  // Scoring runs asynchronously (a BullMQ consumer) after confirmPayment() enqueues the job, so a
  // Seller opening Order Detail immediately after payment may see 422 COURIER_QUOTES_NOT_READY
  // for a moment — poll briefly until quotes exist rather than showing a hard error.
  const quotesQuery = useQuery({
    queryKey: courierQuotesQueryKey(orderId),
    queryFn: () => getCourierQuotes(orderId),
    retry: false,
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.code === 'COURIER_QUOTES_NOT_READY' ? 3000 : false,
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshCourierRates(orderId),
    onSuccess: (quotes) => {
      queryClient.setQueryData(courierQuotesQueryKey(orderId), quotes);
      setSelectedCourier(null);
    },
    onError: (err) => toast.error(formatOrdersError(t, err)),
  });

  // Blocks for up to several minutes on the backend while it retries/falls back across couriers
  // (trackingApi.ts) — the UI below shows a patient, non-dismissable notice rather than treating
  // this like a normal quick mutation.
  const bookMutation = useMutation({
    mutationFn: (courierCode: CourierCode) => bookCourier(orderId, courierCode),
    onSuccess: (order) => {
      queryClient.setQueryData(orderQueryKey(orderId), order);
      queryClient.invalidateQueries({ queryKey: trackingQueryKey(orderId) });
      setOverrideModalOpen(false);
      // A 200 here can mean "booked" OR "every courier failed" — both are success responses per
      // F8-courier-tracking-backend.md, not an error branch.
      if (order.status === 'PENDING_MANUAL_LOGISTICS') {
        toast.warning(t('courier.manualLogisticsToast'));
      } else {
        toast.success(t('courier.bookedToast'));
      }
    },
    onError: (err) => {
      setOverrideModalOpen(false);
      toast.error(formatOrdersError(t, err));
    },
  });

  const stillScoring =
    quotesQuery.isPending ||
    (quotesQuery.isError && quotesQuery.error instanceof ApiError && quotesQuery.error.code === 'COURIER_QUOTES_NOT_READY');

  if (stillScoring) {
    return (
      <Card title={t('courier.cardTitle')}>
        <AIStatus message={t('courier.finding')} />
      </Card>
    );
  }

  if (quotesQuery.isError) {
    return (
      <Card title={t('courier.cardTitle')}>
        <Alert type="error" showIcon message={formatOrdersError(t, quotesQuery.error)} />
      </Card>
    );
  }

  if (!quotesQuery.data) return null;
  const { quotes } = quotesQuery.data;

  if (quotes.length === 0) {
    return (
      <Card title={t('courier.cardTitle')}>
        <Typography.Text type="secondary">{t('courier.emptyQuotes')}</Typography.Text>
      </Card>
    );
  }

  const topScored = quotes[0]!.courier;
  const selected = selectedCourier ?? topScored;
  const isOverride = selected !== topScored;

  function handleConfirmClick() {
    if (isOverride) {
      setOverrideModalOpen(true);
    } else {
      bookMutation.mutate(selected);
    }
  }

  return (
    <Card title={t('courier.cardTitle')}>
      <Radio.Group
        value={selected}
        onChange={(e) => setSelectedCourier(e.target.value as CourierCode)}
        disabled={bookMutation.isPending}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {quotes.map((quote) => {
            const tier = scoreTier(quote.score);
            const isTop = quote.courier === topScored;
            const row = (
              <Space direction="vertical" style={{ width: '100%' }} size={4}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <Typography.Text strong>{t(`courierNames.${quote.courier}`)}</Typography.Text>
                  {isTop && <StatusTag variant="info" label={t('courier.recommendedBadge')} />}
                </span>
                <RecommendationTier label={t(tier.labelKey)} level={tier.level} />
                <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
                  {t('courier.cost')}: <PriceDisplay amount={quote.cost} size="sm" muted /> · {t('courier.eta')}:{' '}
                  {t('courier.etaHours', { hours: quote.etaHours })} · {t('courier.score')}: {quote.score}
                </Typography.Text>
              </Space>
            );
            return (
              <Radio key={quote.courier} value={quote.courier} style={{ width: '100%', alignItems: 'flex-start' }}>
                {isTop ? <AIResultCard style={{ padding: 'var(--sp-3)', display: 'block' }}>{row}</AIResultCard> : row}
              </Radio>
            );
          })}
        </Space>
      </Radio.Group>

      <Space style={{ marginTop: 'var(--sp-4)' }}>
        <Button type="primary" loading={bookMutation.isPending} onClick={handleConfirmClick}>
          {t('courier.confirmBook')}
        </Button>
        <Button loading={refreshMutation.isPending} disabled={bookMutation.isPending} onClick={() => refreshMutation.mutate()}>
          {t('courier.refreshRates')}
        </Button>
      </Space>

      {bookMutation.isPending && <Alert style={{ marginTop: 'var(--sp-3)' }} type="info" showIcon message={t('courier.booking')} />}

      <Modal
        open={overrideModalOpen}
        title={t('courier.overrideConfirmTitle', { courier: t(`courierNames.${selected}`) })}
        onCancel={() => setOverrideModalOpen(false)}
        onOk={() => bookMutation.mutate(selected)}
        confirmLoading={bookMutation.isPending}
      >
        {t('courier.overrideConfirmContent')}
      </Modal>
    </Card>
  );
}
