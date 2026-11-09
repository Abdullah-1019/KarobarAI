import { useState, type ReactNode } from 'react';
import { Alert, Button, Input } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, History, Info, Quote, Sparkles, Truck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { Modal, SkeletonLoader, toast } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { PrivateEvidenceImage } from '../returns/PrivateEvidenceImage';
import { ReturnJourney } from '../returns/ReturnJourney';
import { ReturnSimilarityGauge } from '../returns/ReturnSimilarityGauge';
import { ReturnStatusTag } from '../returns/ReturnStatusTag';
import { reasonLabel } from '../returns/returnFormat';
import { adminAdvanceReturnShipment, adminBookReturnCourier, adminDecideReturn,
  adminReturnDetailQueryKey, getAdminReturnDetail } from './adminApi';
import { formatAdminError } from './adminErrors';
import '../orders/orders.css';
import '../returns/returns.css';

const MOVING = ['BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];

// SCR-AD04's case detail + override panel, on the seller return detail's layout: header, lilac
// journey band, then evidence (reason + appeal, AI gauge, photo pairs, audit history) beside one
// "admin action" card. Unlike the Seller's own decision, `adminDecisionSchema` makes a reason
// mandatory on BOTH approve and reject (BR-008 / REQ-F-Admin-003) — this is the final decision, so
// it always gets an audited reason. Admin-only writes; Support gets the read-only case view.
export function AdminReturnDetailPage() {
  const { t } = useTranslation(['admin', 'returns', 'common']);
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [pendingDecision, setPendingDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [reason, setReason] = useState('');

  const { data: ret, isPending, isError, error, refetch } = useQuery({
    queryKey: adminReturnDetailQueryKey(id),
    queryFn: () => getAdminReturnDetail(id),
    enabled: !!id,
  });

  const decisionMutation = useMutation({
    mutationFn: (input: { decision: 'APPROVED' | 'REJECTED'; reason: string }) => adminDecideReturn(id, input.decision, input.reason),
    onSuccess: (data) => {
      queryClient.setQueryData(adminReturnDetailQueryKey(id), data);
      queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] });
      setPendingDecision(null);
      setReason('');
      toast.success(t('returnDetail.decided'));
    },
    onError: (err) => toast.error(formatAdminError(t, err)),
  });
  const courierMutation = useMutation({
    mutationFn: () => adminBookReturnCourier(id),
    onSuccess: (data) => queryClient.setQueryData(adminReturnDetailQueryKey(id), data),
    onError: (err) => toast.error(formatAdminError(t, err)),
  });
  const trackingMutation = useMutation({
    mutationFn: (leg: 'RETURN' | 'REPLACEMENT') => adminAdvanceReturnShipment(id, leg),
    onSuccess: (data) => queryClient.setQueryData(adminReturnDetailQueryKey(id), data),
    onError: (err) => toast.error(formatAdminError(t, err)),
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
        <Alert type="error" showIcon message={formatAdminError(t, error)}
          action={<Button size="small" shape="round" onClick={() => void refetch()}>{t('common:actions.retry')}</Button>} />
      </div>
    );
  }

  const canDecide = ret.status === 'MANUAL_REVIEW' || ret.status === 'UNDER_DISPUTE';
  const canBook = ret.status === 'APPROVED' && !ret.shipments?.some((shipment) => shipment.leg === 'RETURN');
  const moving = ret.shipments?.filter((shipment) => MOVING.includes(shipment.status)) ?? [];
  const refundPending = ret.fulfillment?.status === 'REFUND_CONSENTED';
  const hasAction = canDecide || canBook || moving.length > 0;
  const finished = ['REFUND_ISSUED', 'CLOSED'].includes(ret.status) || ret.fulfillment?.status === 'EXCHANGE_COMPLETED';

  const headline = canDecide ? t(ret.status === 'UNDER_DISPUTE' ? 'returnDetail.nextAppeal' : 'returnDetail.nextDecide')
    : canBook ? t('returnDetail.nextBook')
    : moving.length > 0 ? t('returnDetail.nextShipping')
    : refundPending ? t('returnDetail.nextRefund')
    : t('returnDetail.nextNone');

  let actions: ReactNode = null;
  if (!isAdmin && hasAction) {
    actions = <p className="adNote"><Info size={15} aria-hidden="true" /> {t('returnDetail.readOnly')}</p>;
  } else if (isAdmin) {
    actions = (
      <>
        {canDecide && (
          <div className="rtActions">
            <Button type="primary" shape="round" icon={<Check size={16} />} onClick={() => setPendingDecision('APPROVED')}>
              {t('returnDetail.approve')}
            </Button>
            <Button danger shape="round" icon={<X size={16} />} onClick={() => setPendingDecision('REJECTED')}>
              {t('returnDetail.reject')}
            </Button>
          </div>
        )}
        {canBook && (
          <Button type="primary" shape="round" icon={<Truck size={16} />} loading={courierMutation.isPending}
            onClick={() => courierMutation.mutate()}>
            {t('returnDetail.bookReturnCourier')}
          </Button>
        )}
        {moving.map((shipment) => (
          <Button key={shipment.leg} shape="round" icon={<Truck size={16} />} loading={trackingMutation.isPending}
            onClick={() => trackingMutation.mutate(shipment.leg)}>
            {t('returnDetail.advanceSimulatedTracking')} · {shipment.leg === 'RETURN' ? t('returnDetail.returnLeg') : t('returnDetail.replacementLeg')}
          </Button>
        ))}
        {(canBook || moving.length > 0) && <p className="rtQuiet">{t('returnDetail.simulatedOnly')}</p>}
      </>
    );
  }

  return (
    <div className="odPage">
      <header className="odHead">
        <div>
          <div className="odTitleRow">
            <h1 className="odTitle">{ret.orderNumber ? `#${ret.orderNumber}` : t('returnsQueue.title')}</h1>
            <ReturnStatusTag status={ret.status} />
          </div>
          <p className="odSub">{t('returns:detailPage.requestedOn', { date: new Date(ret.createdAt).toLocaleDateString() })}</p>
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
              <h2 className="rtEyebrow">{t('returnDetail.reason')}</h2>
              <p className="rtReasonText">{reasonLabel(t, ret.reason)}</p>
              {ret.decisionReason && (
                <p className="rtDecisionNote">{t('returns:detailPage.decisionNote', { reason: ret.decisionReason })}</p>
              )}
              {ret.sellerOverrideReason && (
                <p className="rtDecisionNote">{t('returns:statusPage.sellerOverrode', { reason: ret.sellerOverrideReason })}</p>
              )}
            </div>
          </section>

          {ret.dispute && (
            <section className="odCard">
              <div className="rtAiHead">
                <h2 className="odCardTitle">{t('returnDetail.dispute')}</h2>
                <span className="rtAutoChip">{t(`returnDetail.disputeStatus.${ret.dispute.status}`)}</span>
              </div>
              {ret.dispute.buyerReason && (
                <blockquote className="rtAppeal">
                  <span className="rtAppealLabel">{t('returns:sellerDetail.appealReason')}</span>
                  {ret.dispute.buyerReason}
                </blockquote>
              )}
              {ret.dispute.resolutionReason && <p className="rtDecisionNote">{ret.dispute.resolutionReason}</p>}
              {ret.dispute.adminReason && <p className="rtDecisionNote">{ret.dispute.adminReason}</p>}
            </section>
          )}

          {ret.inspection && (
            <section className="odCard rtAiCard">
              <div className="rtAiHead">
                <h2 className="odCardTitle">
                  <Sparkles size={16} aria-hidden="true" /> {t('returns:sellerDetail.aiInspection')}
                </h2>
                {ret.inspection.aiDecision?.status === 'APPROVED' && (
                  <span className="rtAutoChip">{t('returns:detailPage.autoAccepted')}</span>
                )}
              </div>
              <ReturnSimilarityGauge inspection={ret.inspection} />
              <p className="rtAdvisory">{t('returns:sellerDetail.aiAdvisory')}</p>
            </section>
          )}

          <section className="odCard">
            <h2 className="odCardTitle">{t('returnDetail.photos')}</h2>
            {ret.images.length === 0 ? (
              <p className="rtQuiet">{t('returns:detailPage.noPhotos')}</p>
            ) : (
              <ul className="rtPairs">
                {ret.images.map((img, index) => {
                  const reference = ret.referenceImages[index];
                  const pair = ret.inspection?.pairs.find((p) => p.index === index + 1);
                  return (
                    <li key={img.id} className="rtPair" style={{ animationDelay: `${index * 80}ms` }}>
                      <div className="rtPairHead">
                        <span>{t('returns:wizard.angleNumber', { count: index + 1 })}</span>
                        {pair && <span className="rtPairScore">{t('returns:detailPage.pairMatch', { value: (pair.similarityScore * 100).toFixed(0) })}</span>}
                      </div>
                      <div className="rtPairImgs">
                        {reference && (
                          <figure>
                            <img src={reference.url} alt={t('returns:wizard.referenceAlt', { count: index + 1 })} />
                            <figcaption>{t('returns:detailPage.listingPhoto')}</figcaption>
                          </figure>
                        )}
                        <figure>
                          <PrivateEvidenceImage url={img.cdnUrl} size={132} />
                          <figcaption>{t('returns:detailPage.buyerPhoto')}</figcaption>
                        </figure>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="odCard">
            <h2 className="odCardTitle"><History size={16} aria-hidden="true" /> {t('returnDetail.auditTrail')}</h2>
            {ret.auditTrail && ret.auditTrail.length > 0 ? (
              <ol className="adAudit">
                {ret.auditTrail.map((entry, i) => (
                  <li key={`${entry.createdAt}-${i}`}>
                    <span className="adAuditAction">{entry.action}</span>
                    {entry.reason && <span className="adAuditReason">{entry.reason}</span>}
                    <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rtQuiet">{t('returnDetail.noAudit')}</p>
            )}
          </section>
        </div>

        <aside className="odSide">
          <section className="odNext" key={`${ret.status}-${ret.fulfillment?.status ?? ''}`}
            data-done={(!hasAction && finished) || undefined}
            data-cancelled={(!hasAction && ret.decision === 'REJECTED') || undefined}>
            <span className="odNextLabel">{t(hasAction ? 'returnDetail.nextTitle' : 'returnDetail.statusTitle')}</span>
            <p className="odNextText">{headline}</p>
            {actions}
          </section>

          {(ret.shipments?.length ?? 0) > 0 && (
            <section className="odCard">
              <h2 className="odCardTitle">{t('returns:sellerDetail.exchangeProgress')}</h2>
              <ul className="rtShipments">
                {ret.shipments?.map((shipment) => (
                  <li key={shipment.leg}>
                    <Truck size={15} aria-hidden="true" />
                    <span>
                      <strong>{shipment.leg === 'RETURN' ? t('returnDetail.returnLeg') : t('returnDetail.replacementLeg')}</strong> · {shipment.status}
                      {shipment.courier && <> · {shipment.courier}</>}
                      {shipment.trackingNumber && <span className="rtTracking" dir="ltr">{shipment.trackingNumber}</span>}
                      {shipment.simulated && <span className="rtSim">{t('returns:sellerDetail.simulated')}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <Modal
        open={!!pendingDecision}
        title={pendingDecision === 'APPROVED' ? t('returnDetail.approveConfirmTitle') : t('returnDetail.rejectConfirmTitle')}
        onCancel={() => {
          setPendingDecision(null);
          setReason('');
        }}
        onOk={() => pendingDecision && decisionMutation.mutate({ decision: pendingDecision, reason: reason.trim() })}
        confirmLoading={decisionMutation.isPending}
        okButtonProps={{ danger: pendingDecision === 'REJECTED', disabled: !reason.trim() }}
      >
        <Input.TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('returnDetail.reasonRequired')}
          aria-label={t('returnDetail.reasonRequired')}
          maxLength={500}
          rows={3}
        />
      </Modal>
    </div>
  );
}
