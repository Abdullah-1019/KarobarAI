import { Button } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Info, Loader2, Truck, XCircle, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { CourierQuoteDTO } from '@karobarai/shared';
import { PriceDisplay, toast } from '../../components';
import { orderQueryKey } from '../orders/ordersApi';
import { formatOrdersError } from '../orders/ordersErrors';
import { autoSelectCourier, courierSelectionQueryKey, getCourierSelection, trackingQueryKey } from './trackingApi';

type Breakdown = { factors?: Record<string, number>; weights?: Record<string, number>;
  contributions?: Record<string, number>; total?: number };
type Tone = 'success' | 'warning' | 'error' | 'info';

const TONE_ICON: Record<Tone, LucideIcon> = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info };
const FACTORS = ['cost', 'speed', 'sla', 'rating'] as const;
const FACTOR_LABEL: Record<(typeof FACTORS)[number], string> = {
  cost: 'courier.cost', speed: 'courier.eta', sla: 'courier.sla', rating: 'courier.rating',
};

function Note({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const Icon = TONE_ICON[tone];
  return (
    <div className="crNote" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

function QuoteComparison({ quote }: { quote: CourierQuoteDTO }) {
  const { t } = useTranslation(['orders']);
  const breakdown = quote.breakdown && typeof quote.breakdown === 'object' ? quote.breakdown as Breakdown : null;
  const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  return (
    <li className="crQuote" data-selected={quote.selected || undefined}>
      <div className="crQuoteHead">
        <span className="crQuoteName">{t(`courierNames.${quote.courier}`)}</span>
        {quote.selected && <span className="crChip">{t('courier.selected')}</span>}
        <span className="crScore">{t('courier.score')} <strong>{quote.score ?? '—'}</strong></span>
      </div>
      <dl className="crStats">
        <div><dt>{t('courier.cost')}</dt><dd>{quote.cost == null ? '—' : <PriceDisplay amount={quote.cost} size="sm" />}</dd></div>
        <div><dt>{t('courier.eta')}</dt><dd>{quote.etaHours == null ? '—' : t('courier.etaHours', { hours: quote.etaHours })}</dd></div>
        <div><dt>{t('courier.sla')}</dt><dd>{pct(quote.slaScore)}</dd></div>
        <div><dt>{t('courier.rating')}</dt><dd>{pct(quote.ratingScore)}</dd></div>
      </dl>
      {breakdown?.factors && breakdown.weights && breakdown.contributions && (
        <details className="crWhy">
          <summary>{t('courier.whySelected')}</summary>
          <ul>
            {FACTORS.map((factor) => (
              <li key={factor}>
                <span>{t(FACTOR_LABEL[factor])}</span>
                <span dir="ltr">
                  {breakdown.factors?.[factor]?.toFixed(3)} × {breakdown.weights?.[factor]?.toFixed(2)} = {breakdown.contributions?.[factor]?.toFixed(3)}
                </span>
              </li>
            ))}
            <li className="crWhyTotal"><span>{t('courier.score')}</span><span dir="ltr">{breakdown.total?.toFixed(3)}</span></li>
          </ul>
        </details>
      )}
    </li>
  );
}

// The seller's courier step inside the order detail's "next step" card: simulated-booking notice,
// the current booking state, each scored quote (cost / ETA / SLA / rating, with the weighted
// breakdown behind "Why this courier?"), and the one auto-select action. Logic is unchanged.
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
    <div className="crCard">
      <div className="crHead">
        <span className="crIcon" aria-hidden="true"><Truck size={16} /></span>
        <h3 className="crTitle">{t('courier.cardTitle')}</h3>
        <span className="crSim">{t('courier.simulatedBadge')}</span>
      </div>
      <p className="crHint">{t('courier.simulatedNotice')}</p>

      {selectionQuery.isError && <Note tone="error">{formatOrdersError(t, selectionQuery.error)}</Note>}
      {booked ? (
        <Note tone="success">
          <strong>{t('courier.selected')}: {selection?.shipment.courier ?? ''}</strong>
          <span className="crNoteSub">
            {t('courier.bookingReference')}: <span dir="ltr">{selection?.shipment.bookingReference ?? '—'}</span>
            {' · '}{t('tracking.trackingNo')}: <span dir="ltr">{selection?.shipment.trackingId ?? '—'}</span>
          </span>
        </Note>
      ) : status === 'UNCERTAIN' || status === 'BOOKING' || status === 'EVALUATING' ? (
        <Note tone="warning">{t('courier.uncertain')}</Note>
      ) : !eligible && !status ? (
        <Note tone="info">{t('courier.alreadyBooked')}</Note>
      ) : status === 'FAILED' ? (
        <Note tone="error">
          {selection?.shipment.failureCode === 'NO_VALID_COURIER_QUOTES' ? t('orders:errors.NO_VALID_COURIER_QUOTES') : t('courier.bookingFailed')}
        </Note>
      ) : null}
      {mutation.isError && <Note tone="error">{formatOrdersError(t, mutation.error)}</Note>}

      {selection?.quotes.length ? (
        <ul className="crQuotes">
          {selection.quotes.map((quote) => <QuoteComparison key={quote.courier} quote={quote} />)}
        </ul>
      ) : null}

      {canSubmit && (
        <Button type="primary" shape="round" block icon={<Truck size={16} />} loading={mutation.isPending}
          disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {t('courier.autoSelect')}
        </Button>
      )}
      {mutation.isPending && (
        <p className="crBusy" role="status"><Loader2 size={14} className="crSpin" aria-hidden="true" /> {t('courier.evaluating')}</p>
      )}
    </div>
  );
}
