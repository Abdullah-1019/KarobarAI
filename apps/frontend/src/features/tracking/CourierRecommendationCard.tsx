import { useState } from 'react';
import { Alert, Button, Card, Radio, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { CourierCode } from '@karobarai/shared';
import { ApiError } from '../../api';
import { Modal, SkeletonLoader, toast } from '../../components';
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
        <SkeletonLoader rows={3} />
        <Typography.Text type="secondary">{t('courier.finding')}</Typography.Text>
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
        <Space direction="vertical" style={{ width: '100%' }}>
          {quotes.map((quote) => (
            <Radio key={quote.courier} value={quote.courier} style={{ width: '100%' }}>
              <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }} wrap>
                <span>
                  <Typography.Text strong>{t(`courierNames.${quote.courier}`)}</Typography.Text>
                  {quote.courier === topScored && (
                    <Tag color="blue" style={{ marginLeft: 8 }}>
                      {t('courier.recommendedBadge')}
                    </Tag>
                  )}
                </span>
                <Typography.Text type="secondary">
                  {t('courier.cost')}: Rs. {Number(quote.cost).toLocaleString()} · {t('courier.eta')}:{' '}
                  {t('courier.etaHours', { hours: quote.etaHours })} · {t('courier.score')}: {quote.score}
                </Typography.Text>
              </Space>
            </Radio>
          ))}
        </Space>
      </Radio.Group>

      <Space style={{ marginTop: 16 }}>
        <Button type="primary" loading={bookMutation.isPending} onClick={handleConfirmClick}>
          {t('courier.confirmBook')}
        </Button>
        <Button loading={refreshMutation.isPending} disabled={bookMutation.isPending} onClick={() => refreshMutation.mutate()}>
          {t('courier.refreshRates')}
        </Button>
      </Space>

      {bookMutation.isPending && <Alert style={{ marginTop: 12 }} type="info" showIcon message={t('courier.booking')} />}

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
