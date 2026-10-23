import { useState, type ReactNode } from 'react';
import { Alert, Button, Input, Select, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Quote, Sparkles, Truck, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Modal, SkeletonLoader, toast } from '../../components';
import { PrivateEvidenceImage } from './PrivateEvidenceImage';
import { ReturnJourney } from './ReturnJourney';
import { ReturnSimilarityGauge } from './ReturnSimilarityGauge';
import { listSellerProducts, sellerProductsQueryKey } from '../catalog/catalogApi';
import { getOrder, orderQueryKey } from '../orders/ordersApi';
import { ReturnStatusTag } from './ReturnStatusTag';
import { getSellerReturn, returnQueryKey, sellerBookReplacement, sellerConfirmReturnReceipt,
  sellerDecideReturn, sellerBookReturnCourier, sellerPackReplacement, sellerProposeRefund,
  sellerReserveReplacement } from './returnsApi';
import { formatReturnsError } from './returnsErrors';
import { reasonLabel } from './returnFormat';
import '../orders/orders.css';
import './returns.css';

// SCR-S07's decision panel. Reject requires a reason (mirrors sellerDecisionSchema's own zod
// .refine on the backend — this is a client-side pre-check, not a replacement for it). Escalate
// is audit-only (Task 4.6's Engineering Decision — no new status value for "escalated"), so it
// deliberately doesn't change the visible ReturnStatusTag.
//
// Layout mirrors the order detail: header, a lilac journey band, then evidence (reason, AI gauge,
// photo pairs) beside one "next step" card that holds whichever seller action applies now.
export function SellerReturnDetailPage() {
  const { t } = useTranslation(['returns', 'common']);
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveReason, setApproveReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [receiptCondition, setReceiptCondition] = useState<'RESELLABLE' | 'DAMAGED' | 'NEEDS_INSPECTION'>('RESELLABLE');
  const [replacementProductId, setReplacementProductId] = useState<string>();
  const [refundReason, setRefundReason] = useState('');

  const { data: ret, isPending, isError, error, refetch } = useQuery({
    queryKey: returnQueryKey(id),
    queryFn: () => getSellerReturn(id),
    enabled: !!id,
  });

  // Real order/customer/product context for the "what happened" picture (E5 — Return Details
  // asks for customer/order/product info; ReturnDetailDTO itself only carries the order's
  // publicId, so this reuses the same getOrder() call SellerOrderDetailPage already makes rather
  // than inventing a parallel read). Best-effort: if it fails, the return itself still renders.
  const { data: order } = useQuery({
    queryKey: orderQueryKey(ret?.orderId ?? ''),
    queryFn: () => getOrder(ret!.orderId),
    enabled: !!ret,
  });
  const productsQuery = useQuery({ queryKey: sellerProductsQueryKey('LIVE'),
    queryFn: () => listSellerProducts('LIVE'), enabled: ret?.fulfillment?.status === 'REPLACEMENT_PENDING' });
  const fulfillmentMutation = useMutation({
    mutationFn: async (action: 'receipt' | 'reserve' | 'pack' | 'book' | 'returnCourier' | 'refund') => {
      if (action === 'receipt') return sellerConfirmReturnReceipt(id, receiptCondition);
      if (action === 'reserve') return sellerReserveReplacement(id, replacementProductId!);
      if (action === 'pack') return sellerPackReplacement(id);
      if (action === 'book') return sellerBookReplacement(id);
      if (action === 'returnCourier') return sellerBookReturnCourier(id);
      return sellerProposeRefund(id, refundReason.trim());
    },
    onSuccess: (data) => { queryClient.setQueryData(returnQueryKey(id), data); setRefundReason(''); },
    onError: (err) => toast.error(formatReturnsError(t, err)),
  });

  const decisionMutation = useMutation({
    mutationFn: (input: { decision: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      sellerDecideReturn(id, input.decision, input.reason),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(returnQueryKey(id), data);
      setRejectModalOpen(false);
      setApproveModalOpen(false);
      setApproveReason('');
      setRejectReason('');
      toast.success(variables.decision === 'APPROVED' ? t('sellerDetail.approved') : t('sellerDetail.rejected'));
    },
    onError: (err) => toast.error(formatReturnsError(t, err)),
  });

  if (isPending) {
    return (
      <div className="odPage">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !ret) {
    return (
      <div className="odPage">
        <Alert type="error" showIcon message={formatReturnsError(t, error)}
          action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>} />
      </div>
    );
  }

  const canDecide = ret.status === 'MANUAL_REVIEW' || ret.status === 'UNDER_DISPUTE';
  const canOverride = ret.status === 'APPROVED' && ret.inspection?.aiDecision?.status === 'APPROVED'
    && ret.decisionSource === 'AI' && !(ret.shipments?.length);
  const fulfillment = ret.fulfillment;
  const canBookReturn = ret.status === 'APPROVED' && !ret.shipments?.some((shipment) => shipment.leg === 'RETURN');
  const canReceive = fulfillment?.status === 'AWAITING_SELLER_RECEIPT';
  const canChooseReplacement = !!fulfillment && ['REPLACEMENT_PENDING', 'REFUND_DECLINED'].includes(fulfillment.status)
    && !fulfillment.replacementProductId && ['NONE', 'DECLINED'].includes(fulfillment.refundProposalStatus);
  const canPack = fulfillment?.status === 'REPLACEMENT_PENDING' && !!fulfillment.replacementProductId
    && !ret.shipments?.some((shipment) => shipment.leg === 'REPLACEMENT');
  const canDispatch = fulfillment?.status === 'REPLACEMENT_PACKED'
    && !ret.shipments?.some((shipment) => shipment.leg === 'REPLACEMENT');
  const hasAction = canDecide || canOverride || canBookReturn || canReceive || canChooseReplacement || canPack || canDispatch;

  // The card's one-line headline: the first action that applies, or where the return stands.
  const headline = canDecide ? t(ret.status === 'UNDER_DISPUTE' ? 'next.appeal' : 'next.decide')
    : canBookReturn ? t(canOverride ? 'next.aiAccepted' : 'next.bookReturn')
    : canReceive ? t('next.receive')
    : canChooseReplacement ? t('next.replacement')
    : canPack ? t('next.pack')
    : canDispatch ? t('next.dispatch')
    : ret.decision === 'REJECTED' ? t('next.rejected')
    : fulfillment?.refundProposalStatus === 'PENDING_BUYER' ? t('next.waitingRefund')
    : ['REFUND_ISSUED', 'CLOSED'].includes(ret.status) || fulfillment?.status === 'EXCHANGE_COMPLETED' ? t('next.done')
    : ret.status === 'UNDER_AI_REVIEW' ? t('next.aiReviewing')
    : t('next.waiting');
  const finished = !hasAction && (['REFUND_ISSUED', 'CLOSED'].includes(ret.status) || fulfillment?.status === 'EXCHANGE_COMPLETED');

  const title = ret.orderNumber ? `#${ret.orderNumber}` : t('sellerDetail.title', { id: ret.orderId });

  let nextActions: ReactNode = null;
  if (hasAction) {
    nextActions = (
      <>
        {canDecide && ret.status === 'UNDER_DISPUTE' && ret.dispute?.buyerReason && (
          <blockquote className="rtAppeal">
            <span className="rtAppealLabel">{t('sellerDetail.appealReason')}</span>
            {ret.dispute.buyerReason}
          </blockquote>
        )}
        {canDecide && (
          <div className="rtActions">
            <Button type="primary" loading={decisionMutation.isPending}
              onClick={() => ret.inspection || ret.status === 'UNDER_DISPUTE'
                ? setApproveModalOpen(true) : decisionMutation.mutate({ decision: 'APPROVED' })}>
              {t('sellerDetail.approve')}
            </Button>
            <Button danger disabled={decisionMutation.isPending} onClick={() => setRejectModalOpen(true)}>
              {t('sellerDetail.reject')}
            </Button>
          </div>
        )}
        {canBookReturn && (
          <Button type="primary" icon={<Truck size={16} />} loading={fulfillmentMutation.isPending}
            onClick={() => fulfillmentMutation.mutate('returnCourier')}>
            {t('sellerDetail.bookReturnCourier')}
          </Button>
        )}
        {canOverride && (
          <Button type="text" danger className="odCancel" onClick={() => setRejectModalOpen(true)}>
            {t('sellerDetail.sellerOverride')}
          </Button>
        )}
        {canReceive && (
          <div className="rtField">
            <label className="rtFieldLabel" htmlFor="rt-condition">{t('next.conditionLabel')}</label>
            <Select id="rt-condition" value={receiptCondition} onChange={setReceiptCondition}
              options={(['RESELLABLE', 'DAMAGED', 'NEEDS_INSPECTION'] as const).map((value) => ({ value,
                label: t(`sellerDetail.conditions.${value}`) }))} />
            <Button type="primary" loading={fulfillmentMutation.isPending}
              onClick={() => fulfillmentMutation.mutate('receipt')}>{t('sellerDetail.confirmReceipt')}</Button>
          </div>
        )}
        {canChooseReplacement && fulfillment && (
          <>
            <div className="rtField">
              <label className="rtFieldLabel" htmlFor="rt-replacement">{t('sellerDetail.chooseReplacement')}</label>
              <Select id="rt-replacement" value={replacementProductId} onChange={setReplacementProductId}
                loading={productsQuery.isPending}
                options={productsQuery.data?.items.filter((item) => item.stock >= (ret.itemQuantity ?? 1)).map((item) => ({
                  value: item.id, label: `${item.titleEn} (${item.stock})`,
                })) ?? []} />
              <Button type="primary" loading={fulfillmentMutation.isPending} disabled={!replacementProductId}
                onClick={() => fulfillmentMutation.mutate('reserve')}>{t('sellerDetail.reserveReplacement')}</Button>
            </div>
            {fulfillment.refundProposalStatus === 'NONE' && (
              <div className="rtField rtField--alt">
                <label className="rtFieldLabel" htmlFor="rt-refund">{t('sellerDetail.refundInstead')}</label>
                <Input.TextArea id="rt-refund" value={refundReason} onChange={(event) => setRefundReason(event.target.value)}
                  maxLength={500} rows={2} />
                <Button loading={fulfillmentMutation.isPending} disabled={!refundReason.trim()}
                  onClick={() => fulfillmentMutation.mutate('refund')}>{t('sellerDetail.proposeRefund')}</Button>
              </div>
            )}
          </>
        )}
        {canPack && (
          <Button type="primary" loading={fulfillmentMutation.isPending}
            onClick={() => fulfillmentMutation.mutate('pack')}>{t('sellerDetail.packReplacement')}</Button>
        )}
        {canDispatch && (
          <Button type="primary" icon={<Truck size={16} />} loading={fulfillmentMutation.isPending}
            onClick={() => fulfillmentMutation.mutate('book')}>{t('sellerDetail.dispatchReplacement')}</Button>
        )}
      </>
    );
  }

  return (
    <div className="odPage">
      <header className="odHead">
        <div>
          <div className="odTitleRow">
            <h1 className="odTitle">{title}</h1>
            <ReturnStatusTag status={ret.status} />
          </div>
          <p className="odSub">
            {t('detailPage.requestedOn', { date: new Date(ret.createdAt).toLocaleDateString() })}
          </p>
        </div>
        <div className="odHeadActions">
          <Link to={`/seller/orders/${ret.orderId}`} className="odGhostLink">
            {t('sellerDetail.viewOrder')} <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="odJourneyCard rtBand">
        <span className="odHero" aria-hidden="true">
          {ret.productImage ? <img src={ret.productImage} alt="" /> : <span className="odHeroBlank" />}
        </span>
        <div className="rtBandMain">
          {ret.productName && (
            <p className="rtBandTitle">
              {ret.productName}
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
              <h2 className="rtEyebrow">{t('sellerDetail.reason')}</h2>
              <p className="rtReasonText">{reasonLabel(t, ret.reason)}</p>
              {ret.decisionReason && (
                <p className="rtDecisionNote">{t('detailPage.decisionNote', { reason: ret.decisionReason })}</p>
              )}
            </div>
          </section>

          {ret.inspection && (
            <section className="odCard rtAiCard">
              <div className="rtAiHead">
                <h2 className="odCardTitle">
                  <Sparkles size={16} aria-hidden="true" /> {t('sellerDetail.aiInspection')}
                </h2>
                {ret.inspection.aiDecision?.status === 'APPROVED' && (
                  <span className="rtAutoChip">{t('detailPage.autoAccepted')}</span>
                )}
              </div>
              <ReturnSimilarityGauge inspection={ret.inspection} />
              <p className="rtAdvisory">{t('sellerDetail.aiAdvisory')}</p>
              <details className="rtDetails">
                <summary>{t('detailPage.technical')}</summary>
                <dl>
                  <div>
                    <dt>{t('sellerDetail.inspectionState')}</dt>
                    <dd>{t(`sellerDetail.inspectionValues.${ret.inspection.state}`, { defaultValue: ret.inspection.state })}</dd>
                  </div>
                  <div>
                    <dt>{t('sellerDetail.listingComparison')}</dt>
                    <dd>{ret.inspection.status
                      ? t(`sellerDetail.inspectionValues.${ret.inspection.status}`, { defaultValue: ret.inspection.status })
                      : t('sellerDetail.pending')}</dd>
                  </div>
                  {ret.inspection.reasonCode && (
                    <div>
                      <dt>{t('detailPage.observation')}</dt>
                      <dd>{t(`sellerDetail.inspectionValues.${ret.inspection.reasonCode}`, { defaultValue: ret.inspection.reasonCode })}</dd>
                    </div>
                  )}
                  {ret.inspection.aiDecision && (
                    <div>
                      <dt>{t('detailPage.aiDecisionLabel')}</dt>
                      <dd>
                        {t('sellerDetail.aiDecision', { status: ret.inspection.aiDecision.status, reason: ret.inspection.aiDecision.reason })}
                        <br />
                        {t('sellerDetail.aiThresholds', {
                          accept: ret.inspection.aiDecision.acceptThreshold.toFixed(2),
                          review: ret.inspection.aiDecision.reviewThreshold.toFixed(2),
                          date: new Date(ret.inspection.aiDecision.decidedAt).toLocaleString(),
                        })}
                      </dd>
                    </div>
                  )}
                  {ret.inspection.similarityScore != null && (
                    <div>
                      <dt>{t('sellerDetail.similarityScore')}</dt>
                      <dd>{ret.inspection.similarityScore.toFixed(3)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{t('detailPage.photosCompared')}</dt>
                    <dd>{t('sellerDetail.listingImageCounts', {
                      reference: ret.inspection.referenceImageCount, returned: ret.inspection.returnImageCount,
                    })}</dd>
                  </div>
                  {ret.inspection.pairs.map((pair) => (
                    <div key={pair.index}>
                      <dt>{t('sellerDetail.pairSimilarity', { count: pair.index })}</dt>
                      <dd>{pair.similarityScore.toFixed(3)}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>{t('detailPage.model')}</dt>
                    <dd>{ret.inspection.provider ?? 'manual'} / {ret.inspection.model ?? 'n/a'} / {ret.inspection.policyVersion}</dd>
                  </div>
                </dl>
              </details>
            </section>
          )}

          <section className="odCard">
            <h2 className="odCardTitle">{t('sellerDetail.photos')}</h2>
            {ret.images.length === 0 ? (
              <p className="rtQuiet">{t('detailPage.noPhotos')}</p>
            ) : (
              <ul className="rtPairs">
                {ret.images.map((img, index) => {
                  const reference = ret.referenceImages[index];
                  const pair = ret.inspection?.pairs.find((p) => p.index === index + 1);
                  return (
                    <li key={img.id} className="rtPair" style={{ animationDelay: `${index * 80}ms` }}>
                      <div className="rtPairHead">
                        <span>{t('wizard.angleNumber', { count: index + 1 })}</span>
                        {pair && <span className="rtPairScore">{t('detailPage.pairMatch', { value: (pair.similarityScore * 100).toFixed(0) })}</span>}
                      </div>
                      <div className="rtPairImgs">
                        {reference && (
                          <figure>
                            <img src={reference.url} alt={t('wizard.referenceAlt', { count: index + 1 })} />
                            <figcaption>{t('detailPage.listingPhoto')}</figcaption>
                          </figure>
                        )}
                        <figure>
                          <PrivateEvidenceImage url={img.cdnUrl} size={132} />
                          <figcaption>{t('detailPage.buyerPhoto')}</figcaption>
                        </figure>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="odSide">
          <section className="odNext" key={`${ret.status}-${fulfillment?.status ?? ''}`}
            data-done={finished || undefined} data-cancelled={(!hasAction && ret.decision === 'REJECTED') || undefined}>
            <span className="odNextLabel">{t(hasAction ? 'next.title' : 'next.statusTitle')}</span>
            <p className="odNextText">{headline}</p>
            {nextActions}
          </section>

          {order && (
            <section className="odCard">
              <h2 className="odCardTitle">{t('sellerDetail.orderInfoTitle')}</h2>
              <p className="odLine">
                <User size={15} aria-hidden="true" /> {order.shipping.recipientName}
              </p>
              <ul className="rtOrderItems">
                {order.items.map((item) => (
                  <li key={item.productId}>
                    <span>{item.titleSnapshot}</span>
                    <span className="rtQty">× {item.quantity}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(fulfillment || (ret.shipments?.length ?? 0) > 0) && (
            <section className="odCard">
              <h2 className="odCardTitle">{t('sellerDetail.exchangeProgress')}</h2>
              {fulfillment && (
                <p className="odLine">{t('sellerDetail.fulfillmentState')}: <strong>{fulfillment.status}</strong></p>
              )}
              <ul className="rtShipments">
                {ret.shipments?.map((shipment) => (
                  <li key={shipment.leg}>
                    <Truck size={15} aria-hidden="true" />
                    <span>
                      <strong>{t(`detailPage.leg.${shipment.leg}`)}</strong> · {shipment.status}
                      {shipment.trackingNumber && <span className="rtTracking" dir="ltr">{shipment.trackingNumber}</span>}
                      {shipment.simulated && <span className="rtSim">{t('sellerDetail.simulated')}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <Modal
        open={approveModalOpen}
        title={t('sellerDetail.decisionConfirmTitle')}
        onCancel={() => setApproveModalOpen(false)}
        onOk={() => decisionMutation.mutate({ decision: 'APPROVED', reason: approveReason.trim() })}
        confirmLoading={decisionMutation.isPending}
        okButtonProps={{ disabled: !approveReason.trim() }}
      >
        <Input.TextArea value={approveReason} onChange={(e) => setApproveReason(e.target.value)}
          placeholder={t('sellerDetail.approveReasonLabel')} maxLength={500} />
      </Modal>

      <Modal
        open={rejectModalOpen}
        title={t('sellerDetail.decisionConfirmTitle')}
        onCancel={() => setRejectModalOpen(false)}
        onOk={() => decisionMutation.mutate({ decision: 'REJECTED', reason: rejectReason.trim() })}
        confirmLoading={decisionMutation.isPending}
        okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
      >
        <Input.TextArea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t('sellerDetail.rejectReasonLabel')}
          maxLength={500}
          rows={3}
        />
        {!rejectReason.trim() && (
          <Typography.Text type="danger" style={{ display: 'block', marginTop: 'var(--sp-1)' }}>
            {t('sellerDetail.rejectReasonRequired')}
          </Typography.Text>
        )}
      </Modal>

    </div>
  );
}
