import { useState, type ReactNode } from 'react';
import { Alert, Button, Input, Rate } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Bell, CalendarClock, Hash, Quote, RefreshCw, Star, Truck, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import type { ReturnDetailDTO } from '@karobarai/shared';
import { EmptyState, SkeletonLoader, toast } from '../../components';
import { useOrderSeen } from '../notifications';
import { getOrder, orderQueryKey } from '../orders/ordersApi';
import { PrivateEvidenceImage } from './PrivateEvidenceImage';
import { ReturnJourney } from './ReturnJourney';
import { ReturnStatusTag } from './ReturnStatusTag';
import { appealReturn, buyerReturnsQueryKey, getReturn, listBuyerReturns, returnQueryKey,
  respondToRefundProposal, confirmReplacementReceipt, submitExchangeFeedback } from './returnsApi';
import { formatReturnsError } from './returnsErrors';
import { reasonLabel } from './returnFormat';
import '../orders/orders.css';
import './returns.css';
import './returnBuyer.css';

const PREPARING = new Set(['REPLACEMENT_PENDING', 'REPLACEMENT_PACKED', 'REFUND_DECLINED']);
const ON_WAY_BACK = new Set(['RETURN_IN_TRANSIT', 'AWAITING_SELLER_RECEIPT']);

/** The buyer's one-line "where it stands", from the return status and the exchange stage. */
function buyerHeadline(t: (key: string) => string, ret: ReturnDetailDTO): { text: string; tone?: 'done' | 'stopped' } {
  const stage = ret.fulfillment?.status;
  if (ret.status === 'UNDER_AI_REVIEW') return { text: t('buyerFlow.head.aiReviewing') };
  if (ret.status === 'UNDER_DISPUTE') return { text: t('buyerFlow.head.appeal') };
  if (ret.status === 'REJECTED') {
    return { text: ret.decisionSource === 'AI' ? t('statusPage.aiRejected') : t('buyerFlow.head.rejected') };
  }
  if (ret.status === 'CLOSED' && ret.decision === 'REJECTED') return { text: t('buyerFlow.head.rejectedFinal'), tone: 'stopped' };
  if (ret.refundStatus === 'ISSUED' || ret.status === 'REFUND_ISSUED') return { text: t('buyerFlow.head.refunded'), tone: 'done' };
  if (ret.fulfillment?.refundProposalStatus === 'PENDING_BUYER') return { text: t('buyerFlow.head.refundOffer') };
  if (stage === 'REFUND_CONSENTED') return { text: t('statusPage.refundConsented') };
  if (stage === 'REPLACEMENT_DELIVERED') return { text: t('buyerFlow.head.replacementArrived') };
  if (stage === 'EXCHANGE_COMPLETED') {
    return ret.exchangeFeedback ? { text: t('buyerFlow.head.done'), tone: 'done' } : { text: t('buyerFlow.head.feedback') };
  }
  if (stage === 'REPLACEMENT_IN_TRANSIT') return { text: t('buyerFlow.head.replacementOnWay') };
  if (stage && PREPARING.has(stage)) return { text: t('buyerFlow.head.preparing') };
  if (stage && ON_WAY_BACK.has(stage)) return { text: t('buyerFlow.head.onWayBack') };
  if (ret.status === 'PICKUP_BOOKED') return { text: t('buyerFlow.head.pickup') };
  if (ret.status === 'APPROVED') return { text: t('buyerFlow.head.approved') };
  if (ret.status === 'CLOSED') return { text: t('buyerFlow.head.done'), tone: 'done' };
  return { text: t('buyerFlow.head.waitingSeller') };
}

// Mirrors the seller's return detail: header, a lilac journey band, then the reason and the
// buyer's photos beside one "what happens next" card holding whichever buyer action applies
// (answer a refund offer, appeal, confirm a replacement, rate the exchange).
//
// New links carry the exact return ID so separate items in one order open the right case.
// The original order-only URL still resolves through buyer history for older bookmarks.
//
// The seller/admin's decision reason is only on the DTO for some decisions; otherwise it reaches
// the buyer via the RETURN_DECISION notification, so the card points there instead of inventing it.
export function ReturnStatusPage() {
  const { t } = useTranslation(['returns', 'orders', 'common']);
  const { id: orderId = '', returnId } = useParams<{ id: string; returnId?: string }>();
  useOrderSeen('returns', orderId);
  const queryClient = useQueryClient();
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');

  const listQuery = useQuery({
    queryKey: buyerReturnsQueryKey,
    queryFn: () => listBuyerReturns(),
    enabled: !returnId,
  });

  const matchedReturnId = returnId ?? listQuery.data?.items.find((item) => item.orderId === orderId)?.id;

  const detailQuery = useQuery({
    queryKey: returnQueryKey(matchedReturnId ?? ''),
    queryFn: () => getReturn(matchedReturnId!),
    enabled: !!matchedReturnId,
    refetchInterval: (query) => query.state.data?.status === 'UNDER_AI_REVIEW' ? 3000 : false,
  });

  // Fallback product name for older returns whose DTO has no productName.
  const { data: order } = useQuery({
    queryKey: orderQueryKey(orderId),
    queryFn: () => getOrder(orderId),
    enabled: !!orderId,
  });

  const appealMutation = useMutation({
    mutationFn: () => appealReturn(matchedReturnId!, appealReason.trim()),
    onSuccess: (data) => {
      queryClient.setQueryData(returnQueryKey(matchedReturnId!), data);
      toast.success(t('statusPage.appealed'));
      setAppealOpen(false);
      setAppealReason('');
    },
    onError: (err) => toast.error(formatReturnsError(t, err)),
  });
  const refundResponseMutation = useMutation({
    mutationFn: (accept: boolean) => respondToRefundProposal(matchedReturnId!, accept),
    onSuccess: (data) => queryClient.setQueryData(returnQueryKey(matchedReturnId!), data),
    onError: (err) => toast.error(formatReturnsError(t, err)),
  });
  const replacementReceiptMutation = useMutation({
    mutationFn: () => confirmReplacementReceipt(matchedReturnId!),
    onSuccess: (data) => queryClient.setQueryData(returnQueryKey(matchedReturnId!), data),
    onError: (err) => toast.error(formatReturnsError(t, err)),
  });
  const feedbackMutation = useMutation({
    mutationFn: () => submitExchangeFeedback(matchedReturnId!, feedbackRating, feedbackComment.trim()),
    onSuccess: (data) => queryClient.setQueryData(returnQueryKey(matchedReturnId!), data),
    onError: (err) => toast.error(formatReturnsError(t, err)),
  });

  if ((!returnId && listQuery.isPending) || (matchedReturnId && detailQuery.isPending)) {
    return (
      <div className="odPage">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (!returnId && listQuery.isError) {
    return (
      <div className="odPage">
        <Alert type="error" showIcon message={formatReturnsError(t, listQuery.error)}
          action={<Button shape="round" onClick={() => void listQuery.refetch()}>{t('common:actions.retry')}</Button>} />
      </div>
    );
  }

  if (matchedReturnId && detailQuery.isError && !detailQuery.data) {
    return (
      <div className="odPage">
        <Alert type="error" showIcon message={formatReturnsError(t, detailQuery.error)}
          action={<Button shape="round" onClick={() => void detailQuery.refetch()}>{t('common:actions.retry')}</Button>} />
      </div>
    );
  }

  if (!matchedReturnId || !detailQuery.data || detailQuery.data.orderId !== orderId) {
    return (
      <div className="odPage">
        <EmptyState title={t('statusPage.title')} description={t('statusPage.notFound')} />
      </div>
    );
  }

  const ret = detailQuery.data;
  const fulfillment = ret.fulfillment;
  const visibleStatus = ret.status === 'CLOSED' && ret.decision === 'REJECTED' ? 'REJECTED' : ret.status;
  const headline = buyerHeadline(t, ret);
  const productName = ret.productName
    ?? order?.items.find((item) => !ret.productId || item.productId === ret.productId)?.titleSnapshot;

  const canAnswerRefund = fulfillment?.refundProposalStatus === 'PENDING_BUYER';
  const canAppeal = ret.status === 'REJECTED';
  const canConfirmReplacement = fulfillment?.status === 'REPLACEMENT_DELIVERED';
  const canRate = fulfillment?.status === 'EXCHANGE_COMPLETED' && !ret.exchangeFeedback;
  const hasAction = canAnswerRefund || canAppeal || canConfirmReplacement || canRate;
  const showDecisionHint = !!ret.decision && ret.decisionSource !== 'AI' && !ret.sellerOverrideReason && !ret.decisionReason;

  const showReturnShipping = ['APPROVED', 'PICKUP_BOOKED', 'REFUND_ISSUED'].includes(ret.status);
  const shipping = ret.returnShipping;
  const hasReturnTracking = Boolean(shipping && (shipping.courier || shipping.bookingReference || shipping.trackingNumber
    || shipping.trackingUrl || shipping.estimatedPickupAt || shipping.estimatedDeliveryAt));
  const replacementShipments = ret.shipments?.filter((shipment) => shipment.leg === 'REPLACEMENT') ?? [];

  let nextActions: ReactNode = null;
  if (canAnswerRefund) {
    nextActions = (
      <>
        {fulfillment?.refundProposalReason && (
          <blockquote className="rtAppeal">
            <span className="rtAppealLabel">{t('statusPage.refundProposal')}</span>
            {fulfillment.refundProposalReason}
          </blockquote>
        )}
        <div className="rtActions">
          <Button type="primary" shape="round" loading={refundResponseMutation.isPending}
            onClick={() => refundResponseMutation.mutate(true)}>{t('statusPage.acceptRefundProposal')}</Button>
          <Button shape="round" disabled={refundResponseMutation.isPending}
            onClick={() => refundResponseMutation.mutate(false)}>{t('statusPage.declineRefundProposal')}</Button>
        </div>
      </>
    );
  } else if (canAppeal) {
    nextActions = appealOpen ? (
      <div className="rtField">
        <label className="rtFieldLabel" htmlFor="rs-appeal">{t('statusPage.appealConfirmContent')}</label>
        <Input.TextArea id="rs-appeal" value={appealReason} onChange={(event) => setAppealReason(event.target.value)}
          maxLength={500} showCount rows={3} autoFocus />
        <div className="rtActions">
          <Button type="primary" shape="round" loading={appealMutation.isPending} disabled={!appealReason.trim()}
            onClick={() => appealMutation.mutate()}>{t('buyerFlow.appealSend')}</Button>
          <Button shape="round" disabled={appealMutation.isPending} onClick={() => setAppealOpen(false)}>
            {t('buyerFlow.cancel')}
          </Button>
        </div>
      </div>
    ) : (
      <Button type="primary" shape="round" onClick={() => setAppealOpen(true)}>{t('statusPage.appeal')}</Button>
    );
  } else if (canConfirmReplacement) {
    nextActions = (
      <>
        <p className="rsNote">{t('statusPage.replacementAwaitingConfirmation')}</p>
        <Button type="primary" shape="round" loading={replacementReceiptMutation.isPending}
          onClick={() => replacementReceiptMutation.mutate()}>{t('statusPage.confirmReplacementReceipt')}</Button>
      </>
    );
  } else if (canRate) {
    nextActions = (
      <div className="rtField">
        <Rate value={feedbackRating} onChange={setFeedbackRating} aria-label={t('statusPage.feedbackRating')} />
        <Input.TextArea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)}
          maxLength={1000} rows={3} placeholder={t('statusPage.feedbackComment')} aria-label={t('statusPage.feedbackComment')} />
        <Button type="primary" shape="round" disabled={feedbackRating < 1} loading={feedbackMutation.isPending}
          onClick={() => feedbackMutation.mutate()}>{t('statusPage.submitFeedback')}</Button>
      </div>
    );
  }

  return (
    <div className="odPage">
      <header className="odHead">
        <div>
          <div className="odTitleRow">
            <h1 className="odTitle">{t('statusPage.title')}</h1>
            <ReturnStatusTag status={visibleStatus} />
          </div>
          <p className="odSub">
            {ret.orderNumber && <>#{ret.orderNumber} · </>}
            {t('detailPage.requestedOn', { date: new Date(ret.createdAt).toLocaleDateString() })}
          </p>
        </div>
        <div className="odHeadActions">
          <Link to={`/orders/${orderId}`} className="odGhostLink">
            {t('buyerFlow.viewOrder')} <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="odJourneyCard rtBand">
        <span className="odHero" aria-hidden="true">
          {ret.productImage ? <img src={ret.productImage} alt="" /> : <span className="odHeroBlank" />}
        </span>
        <div className="rtBandMain">
          {productName && (
            <p className="rtBandTitle">
              {productName}
              {ret.itemQuantity && ret.itemQuantity > 1 ? ` × ${ret.itemQuantity}` : ''}
            </p>
          )}
          <ReturnJourney ret={ret} />
        </div>
      </section>

      <div className="odGrid">
        <div className="odMain">
          <section className="odCard rtReasonCard">
            <span className="rtQuoteIcon" aria-hidden="true">
              <Quote size={18} />
            </span>
            <div>
              <h2 className="rtEyebrow">{t('statusPage.reason')}</h2>
              <p className="rtReasonText">{reasonLabel(t, ret.reason)}</p>
              {ret.sellerOverrideReason && (
                <p className="rtDecisionNote">{t('statusPage.sellerOverrode', { reason: ret.sellerOverrideReason })}</p>
              )}
              {!ret.sellerOverrideReason && ret.decisionReason && (
                <p className="rtDecisionNote">
                  {ret.decision === 'REJECTED' ? `${t('statusPage.rejectionReason')}: ${ret.decisionReason}`
                    : t('detailPage.decisionNote', { reason: ret.decisionReason })}
                </p>
              )}
            </div>
          </section>

          <section className="odCard">
            <h2 className="odCardTitle">{t('buyerFlow.photosCard')}</h2>
            {ret.images.length === 0 ? (
              <p className="rtQuiet">{t('buyerFlow.noPhotos')}</p>
            ) : (
              <ul className="rsPhotos">
                {ret.images.map((img, index) => (
                  <li key={img.id} style={{ animationDelay: `${index * 70}ms` }}>
                    <PrivateEvidenceImage url={img.cdnUrl} fill />
                    <span>{t('wizard.angleNumber', { count: index + 1 })}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {replacementShipments.length > 0 && (
            <section className="odCard">
              <h2 className="odCardTitle">{t('statusPage.replacementShippingTitle')}</h2>
              {fulfillment?.replacementProductName && (
                <p className="odLine">{t('buyerFlow.replacementLabel', { name: fulfillment.replacementProductName })}</p>
              )}
              {replacementShipments.map((shipment) => (
                <div key={shipment.leg} className="rsShipment">
                  <p className="odLine"><Truck size={15} aria-hidden="true" />
                    <span>{shipment.courier ?? t('statusPage.simulatedShipment')} · {shipment.status}
                      {shipment.trackingNumber && <span className="rtTracking" dir="ltr">{shipment.trackingNumber}</span>}
                    </span>
                  </p>
                  {shipment.estimatedDeliveryAt && (
                    <p className="odLine"><CalendarClock size={15} aria-hidden="true" />
                      {t('statusPage.simulatedEstimatedDelivery')}: {new Date(shipment.estimatedDeliveryAt).toLocaleString()}
                    </p>
                  )}
                  {shipment.events.length > 0 && (
                    <ol className="rsEvents">
                      {[...shipment.events].reverse().map((event) => (
                        <li key={event.eventTime}>
                          <span>{event.description}</span>
                          <time dateTime={event.eventTime}>{new Date(event.eventTime).toLocaleString()}</time>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>

        <aside className="odSide">
          <section className="odNext" key={`${ret.status}-${fulfillment?.status ?? ''}`}
            data-done={headline.tone === 'done' || undefined} data-cancelled={headline.tone === 'stopped' || undefined}>
            <span className="odNextLabel">{t(hasAction ? 'buyerFlow.nextLabel' : 'buyerFlow.statusLabel')}</span>
            <p className="odNextText">{headline.text}</p>
            {ret.status === 'UNDER_AI_REVIEW' && (
              <p className="rsLive"><span className="rsLiveDot" aria-hidden="true" />{t('buyerFlow.autoRefresh')}</p>
            )}
            {nextActions}
            {showDecisionHint && (
              <Link to="/notifications" className="rsHint">
                <Bell size={15} aria-hidden="true" /> {t('statusPage.decisionReasonHint')}
              </Link>
            )}
            <div className="rsFacts">
              <p className="odLine"><Wallet size={15} aria-hidden="true" />
                {t('buyerFlow.refundLine', {
                  status: ret.refundStatus === 'ISSUED' ? t('statusPage.refundIssued') : t('statusPage.refundNotIssued'),
                })}
              </p>
              {ret.exchangeFeedback && (
                <p className="odLine"><Star size={15} aria-hidden="true" />
                  {t('statusPage.feedbackSubmitted', { rating: ret.exchangeFeedback.rating })}
                </p>
              )}
              {ret.decidedAt && (
                <p className="odLine"><CalendarClock size={15} aria-hidden="true" />
                  {t('statusPage.decidedAt', { date: new Date(ret.decidedAt).toLocaleString() })}
                </p>
              )}
            </div>
            <Button type="text" className="rsRefresh" icon={<RefreshCw size={14} />}
              loading={detailQuery.isFetching} onClick={() => void detailQuery.refetch()}>
              {t('statusPage.refresh')}
            </Button>
            {detailQuery.isError && <Alert type="error" showIcon message={formatReturnsError(t, detailQuery.error)} />}
          </section>

          {showReturnShipping && (
            <section className="odCard">
              <h2 className="odCardTitle">{t('statusPage.returnShippingTitle')}</h2>
              {shipping?.status === 'BOOKING_DETAILS_UNAVAILABLE' ? (
                <p className="rtQuiet">{t('statusPage.bookingDetailsUnavailable')}</p>
              ) : hasReturnTracking ? (
                <>
                  {shipping.courier && <p className="odLine"><Truck size={15} aria-hidden="true" />{shipping.courier}</p>}
                  {shipping.bookingReference && (
                    <p className="odLine"><Hash size={15} aria-hidden="true" />
                      {t('statusPage.bookingReference')}: <span dir="ltr">{shipping.bookingReference}</span>
                    </p>
                  )}
                  {shipping.trackingNumber && (
                    <p className="odLine"><Hash size={15} aria-hidden="true" />
                      {t('statusPage.trackingNumber')}: <span dir="ltr">{shipping.trackingNumber}</span>
                    </p>
                  )}
                  {shipping.estimatedPickupAt && (
                    <p className="odLine"><CalendarClock size={15} aria-hidden="true" />
                      {t('statusPage.estimatedPickup')}: {new Date(shipping.estimatedPickupAt).toLocaleString()}
                    </p>
                  )}
                  {shipping.estimatedDeliveryAt && (
                    <p className="odLine"><CalendarClock size={15} aria-hidden="true" />
                      {t('statusPage.simulatedEstimatedDelivery')}: {new Date(shipping.estimatedDeliveryAt).toLocaleString()}
                    </p>
                  )}
                  {shipping.trackingUrl && (
                    <a href={shipping.trackingUrl} target="_blank" rel="noreferrer" className="odGhostLink odGhostLink--block">
                      {t('statusPage.trackReturn')} <ArrowUpRight size={15} aria-hidden="true" />
                    </a>
                  )}
                </>
              ) : (
                <p className="rtQuiet">{t('statusPage.courierNotBooked')}</p>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
