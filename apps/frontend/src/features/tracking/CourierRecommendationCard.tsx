import { Alert, Button, Card, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { CourierQuoteDTO } from '@karobarai/shared';
import { PriceDisplay, toast } from '../../components';
import { orderQueryKey } from '../orders/ordersApi';
import { formatOrdersError } from '../orders/ordersErrors';
import { autoSelectCourier, courierSelectionQueryKey, getCourierSelection, trackingQueryKey } from './trackingApi';

type Breakdown = { factors?: Record<string, number>; weights?: Record<string, number>;
  contributions?: Record<string, number>; total?: number };

function QuoteComparison({ quote }: { quote: CourierQuoteDTO }) {
  const { t } = useTranslation(['orders']);
  const breakdown = quote.breakdown && typeof quote.breakdown === 'object' ? quote.breakdown as Breakdown : null;
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 'var(--sp-3)' }}>
      <Space>
        <Typography.Text strong>{t(`courierNames.${quote.courier}`)}</Typography.Text>
        {quote.selected && <Tag color="blue">{t('courier.selected')}</Tag>}
      </Space>
      <div>{t('courier.cost')}: {quote.cost == null ? '—' : <PriceDisplay amount={quote.cost} size="sm" />} · {t('courier.eta')}: {quote.etaHours == null ? '—' : `${quote.etaHours}h`}</div>
      <div>SLA: {quote.slaScore == null ? '—' : `${Math.round(quote.slaScore * 100)}%`} · {t('courier.rating')}: {quote.ratingScore == null ? '—' : `${Math.round(quote.ratingScore * 100)}%`}</div>
      <Typography.Text>{t('courier.score')}: {quote.score ?? '—'}</Typography.Text>
      {breakdown?.factors && breakdown.weights && breakdown.contributions && (
        <details>
          <summary>{t('courier.whySelected')}</summary>
          {(['cost', 'speed', 'sla', 'rating'] as const).map((factor) => (
            <div key={factor}>{factor}: {breakdown.factors?.[factor]?.toFixed(3)} × {breakdown.weights?.[factor]?.toFixed(2)} = {breakdown.contributions?.[factor]?.toFixed(3)}</div>
          ))}
          <strong>{t('courier.score')}: {breakdown.total?.toFixed(3)}</strong>
        </details>
      )}
    </div>
  );
}

export function CourierRecommendationCard({ orderId, eligible }: { orderId: string; eligible: boolean }) {
  const { t } = useTranslation(['orders']);
  const queryClient = useQueryClient();
  const selectionQuery = useQuery({ queryKey: courierSelectionQueryKey(orderId),
    queryFn: () => getCourierSelection(orderId) });
  const mutation = useMutation({
    mutationFn: () => autoSelectCourier(orderId),
    onSuccess: (result) => {
      queryClient.setQueryData(courierSelectionQueryKey(orderId), result);
      queryClient.invalidateQueries({ queryKey: orderQueryKey(orderId) });
      queryClient.invalidateQueries({ queryKey: trackingQueryKey(orderId) });
      if (result.shipment.status === 'BOOKED') toast.success(t('courier.bookedToast'));
    },
    onError: () => queryClient.invalidateQueries({ queryKey: courierSelectionQueryKey(orderId) }),
  });
  const selection = selectionQuery.data;
  const status = selection?.shipment.status;
  const booked = status != null && ['BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(status);
  const canSubmit = eligible && !selectionQuery.isLoading && (!status || status === 'FAILED');
  return (
    <Card title={t('courier.cardTitle')}>
      <Alert type="info" showIcon message={t('courier.simulatedNotice')} style={{ marginBottom: 'var(--sp-3)' }} />
      {selectionQuery.isError && <Alert type="error" showIcon message={formatOrdersError(t, selectionQuery.error)} />}
      {booked ? (
        <Alert type="success" showIcon message={`${t('courier.selected')}: ${selection?.shipment.courier ?? ''}`}
          description={`${t('courier.bookingReference')}: ${selection?.shipment.bookingReference ?? '—'} · ${t('tracking.trackingNo')}: ${selection?.shipment.trackingId ?? '—'}`} />
      ) : status === 'UNCERTAIN' || status === 'BOOKING' || status === 'EVALUATING' ? (
        <Alert type="warning" showIcon message={t('courier.uncertain')} />
      ) : !eligible && !status ? (
        <Alert type="info" showIcon message={t('courier.alreadyBooked')} />
      ) : status === 'FAILED' ? (
        <Alert type="error" showIcon message={selection?.shipment.failureCode === 'NO_VALID_COURIER_QUOTES'
          ? t('orders:errors.NO_VALID_COURIER_QUOTES') : t('courier.bookingFailed')} />
      ) : null}
      {mutation.isError && <Alert type="error" showIcon style={{ marginTop: 'var(--sp-3)' }}
        message={formatOrdersError(t, mutation.error)} />}
      {selection?.quotes.length ? (
        <Space direction="vertical" style={{ width: '100%', marginTop: 'var(--sp-3)' }}>
          {selection.quotes.map((quote) => <QuoteComparison key={quote.courier} quote={quote} />)}
        </Space>
      ) : null}
      {canSubmit && <Button type="primary" loading={mutation.isPending} disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        style={{ marginTop: 'var(--sp-3)' }}>{t('courier.autoSelect')}</Button>}
      {mutation.isPending && <Typography.Text style={{ display: 'block' }}>{t('courier.evaluating')}</Typography.Text>}
    </Card>
  );
}
