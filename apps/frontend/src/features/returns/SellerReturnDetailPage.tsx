import { useState } from 'react';
import { Alert, Button, Card, Input, Select, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Modal, PageHeader, SkeletonLoader, toast } from '../../components';
import { PrivateEvidenceImage } from './PrivateEvidenceImage';
import { ReturnSimilarityScale } from './ReturnSimilarityScale';
import { listSellerProducts, sellerProductsQueryKey } from '../catalog/catalogApi';
import { getOrder, orderQueryKey } from '../orders/ordersApi';
import { ReturnProgressTimeline } from './ReturnProgressTimeline';
import { ReturnStatusTag } from './ReturnStatusTag';
import { getSellerReturn, returnQueryKey, sellerBookReplacement, sellerConfirmReturnReceipt,
  sellerDecideReturn, sellerBookReturnCourier, sellerPackReplacement, sellerProposeRefund,
  sellerReserveReplacement } from './returnsApi';
import { formatReturnsError } from './returnsErrors';

// SCR-S07's decision panel. Reject requires a reason (mirrors sellerDecisionSchema's own zod
// .refine on the backend — this is a client-side pre-check, not a replacement for it). Escalate
// is audit-only (Task 4.6's Engineering Decision — no new status value for "escalated"), so it
// deliberately doesn't change the visible ReturnStatusTag.
export function SellerReturnDetailPage() {
  const { t } = useTranslation(['returns']);
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveReason, setApproveReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [receiptCondition, setReceiptCondition] = useState<'RESELLABLE' | 'DAMAGED' | 'NEEDS_INSPECTION'>('RESELLABLE');
  const [replacementProductId, setReplacementProductId] = useState<string>();
  const [refundReason, setRefundReason] = useState('');

  const { data: ret, isPending, isError, error } = useQuery({
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
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !ret) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Alert type="error" showIcon message={formatReturnsError(t, error)} />
      </div>
    );
  }

  const canDecide = ret.status === 'MANUAL_REVIEW' || ret.status === 'UNDER_DISPUTE';
  const canOverride = ret.status === 'APPROVED' && ret.inspection?.aiDecision?.status === 'APPROVED'
    && ret.decisionSource === 'AI' && !(ret.shipments?.length);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <PageHeader
        title={ret.orderNumber ? `Order #${ret.orderNumber}` : t('sellerDetail.title', { id: ret.orderId })}
        backTo="/seller/returns"
        backLabel={t('sellerList.title')}
        actions={<ReturnStatusTag status={ret.status} />}
      />

      {order && (
        <Card title={t('sellerDetail.orderInfoTitle')} style={{ marginBottom: 'var(--sp-4)' }}>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 'var(--sp-1)' }}>
            {t('sellerDetail.customerLabel')}
          </Typography.Text>
          <Typography.Text strong>{order.shipping.recipientName}</Typography.Text>

          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 'var(--sp-3)', marginBottom: 'var(--sp-1)' }}>
            {t('sellerDetail.itemsLabel')}
          </Typography.Text>
          <ul style={{ margin: 0, paddingInlineStart: 'var(--sp-5)' }}>
            {order.items.map((item) => (
              <li key={item.productId}>
                {item.titleSnapshot} × {item.quantity}
              </li>
            ))}
          </ul>

          <Link to={`/seller/orders/${ret.orderId}`} style={{ display: 'inline-block', marginTop: 'var(--sp-3)' }}>
            {t('sellerDetail.viewOrder')}
          </Link>
        </Card>
      )}

      <Card title={t('statusPage.progressTitle')} style={{ marginBottom: 'var(--sp-4)' }}>
        <ReturnProgressTimeline ret={ret} />
      </Card>

      <Typography.Title level={5} style={{ marginBottom: 'var(--sp-2)' }}>
        {t('sellerDetail.whatHappenedLabel')}
      </Typography.Title>

      <Card title={t('sellerDetail.reason')} style={{ marginBottom: 'var(--sp-4)' }}>
        {ret.reason.startsWith('OTHER: ')
          ? `${t('reasons.OTHER')}: ${ret.reason.slice(7)}`
          : t(`reasons.${ret.reason}`, { defaultValue: ret.reason })}
      </Card>
      {ret.status === 'UNDER_DISPUTE' && ret.dispute?.buyerReason &&
        <Alert type="info" showIcon style={{ marginBottom: 'var(--sp-4)' }}
          message={t('sellerDetail.appealReason')} description={ret.dispute.buyerReason} />}

      {canDecide && (
        <Card title={ret.status === 'UNDER_DISPUTE' ? t('sellerDetail.reviewAppeal')
          : t('sellerDetail.whatYouCanDoLabel')} style={{ marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <Button type="primary" loading={decisionMutation.isPending}
              onClick={() => ret.inspection || ret.status === 'UNDER_DISPUTE'
                ? setApproveModalOpen(true) : decisionMutation.mutate({ decision: 'APPROVED' })}>
              {t('sellerDetail.approve')}
            </Button>
            <Button danger disabled={decisionMutation.isPending} onClick={() => setRejectModalOpen(true)}>
              {t('sellerDetail.reject')}
            </Button>
          </div>
        </Card>
      )}

      <Card title={t('sellerDetail.photos')} style={{ marginBottom: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
          {ret.images.map((img, index) => <div key={img.id}>
            <Typography.Text>{t('wizard.angleNumber', { count: index + 1 })}</Typography.Text><br />
            {ret.referenceImages[index] && <img src={ret.referenceImages[index].url}
              alt={t('wizard.referenceAlt', { count: index + 1 })}
              style={{ width: 120, height: 120, objectFit: 'contain' }} />}
            <PrivateEvidenceImage url={img.cdnUrl} size={120} />
          </div>)}
        </div>
      </Card>

      {ret.inspection && (
        <Card title={t('sellerDetail.aiInspection')} style={{ marginBottom: 'var(--sp-4)' }}>
          {ret.inspection.aiDecision?.status === 'APPROVED' && <Alert type="success" showIcon
            message={t('sellerDetail.automaticallyAccepted')} style={{ marginBottom: 'var(--sp-3)' }} />}
          <ReturnSimilarityScale inspection={ret.inspection} />
          <Alert type="info" message={t('sellerDetail.aiAdvisory')} style={{ marginBottom: 'var(--sp-3)' }} />
          <Typography.Paragraph>{t('sellerDetail.inspectionState')}: {t(`sellerDetail.inspectionValues.${ret.inspection.state}`, { defaultValue: ret.inspection.state })}</Typography.Paragraph>
          <Typography.Paragraph>{t('sellerDetail.listingComparison')}: {ret.inspection.status
            ? t(`sellerDetail.inspectionValues.${ret.inspection.status}`, { defaultValue: ret.inspection.status }) : t('sellerDetail.pending')}</Typography.Paragraph>
          {ret.inspection.reasonCode && <Typography.Paragraph>{t(`sellerDetail.inspectionValues.${ret.inspection.reasonCode}`, { defaultValue: ret.inspection.reasonCode })}</Typography.Paragraph>}
          {ret.inspection.aiDecision && <>
            <Typography.Paragraph>{t('sellerDetail.aiDecision', {
              status: ret.inspection.aiDecision.status, reason: ret.inspection.aiDecision.reason,
            })}</Typography.Paragraph>
            <Typography.Paragraph>{t('sellerDetail.aiThresholds', {
              accept: ret.inspection.aiDecision.acceptThreshold.toFixed(2),
              review: ret.inspection.aiDecision.reviewThreshold.toFixed(2),
              date: new Date(ret.inspection.aiDecision.decidedAt).toLocaleString(),
            })}</Typography.Paragraph>
          </>}
          {ret.inspection.similarityScore != null && (
            <Typography.Paragraph>{t('sellerDetail.similarityScore')}: {ret.inspection.similarityScore.toFixed(3)}</Typography.Paragraph>
          )}
          <Typography.Paragraph>{t('sellerDetail.listingImageCounts', {
            reference: ret.inspection.referenceImageCount, returned: ret.inspection.returnImageCount,
          })}</Typography.Paragraph>
          {ret.inspection.pairs.map((pair) => <Typography.Paragraph key={pair.index}>
            {t('sellerDetail.pairSimilarity', { count: pair.index })}: {pair.similarityScore.toFixed(3)}
          </Typography.Paragraph>)}
          <Typography.Text type="secondary">{ret.inspection.provider ?? 'manual'} / {ret.inspection.model ?? 'n/a'} / {ret.inspection.policyVersion}</Typography.Text>
        </Card>
      )}

      {canOverride && <Button danger onClick={() => setRejectModalOpen(true)}>
        {t('sellerDetail.sellerOverride')}
      </Button>}
      {ret.status === 'APPROVED' && !ret.shipments?.some((shipment) => shipment.leg === 'RETURN') &&
        <Button type="primary" loading={fulfillmentMutation.isPending}
          onClick={() => fulfillmentMutation.mutate('returnCourier')}>
          {t('sellerDetail.bookReturnCourier')}
        </Button>}
      {ret.fulfillment && <Card title={t('sellerDetail.exchangeProgress')} style={{ marginTop: 'var(--sp-4)' }}>
        <p>{t('sellerDetail.fulfillmentState')}: {ret.fulfillment.status}</p>
        {ret.shipments?.map((shipment) => <p key={shipment.leg}>
          {shipment.leg} · {shipment.status} · {shipment.simulated ? t('sellerDetail.simulated') : ''}
          {shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ''}
        </p>)}
        {ret.fulfillment.status === 'AWAITING_SELLER_RECEIPT' && <div>
          <Select value={receiptCondition} onChange={setReceiptCondition} style={{ minWidth: 220 }}
            options={(['RESELLABLE', 'DAMAGED', 'NEEDS_INSPECTION'] as const).map((value) => ({ value,
              label: t(`sellerDetail.conditions.${value}`) }))} />{' '}
          <Button type="primary" loading={fulfillmentMutation.isPending}
            onClick={() => fulfillmentMutation.mutate('receipt')}>{t('sellerDetail.confirmReceipt')}</Button>
        </div>}
        {['REPLACEMENT_PENDING', 'REFUND_DECLINED'].includes(ret.fulfillment.status)
          && !ret.fulfillment.replacementProductId &&
          ['NONE', 'DECLINED'].includes(ret.fulfillment.refundProposalStatus) && <div>
            <p>{t('sellerDetail.chooseReplacement')}</p>
            <Select value={replacementProductId} onChange={setReplacementProductId} style={{ minWidth: 260 }}
              loading={productsQuery.isPending}
              options={productsQuery.data?.items.filter((item) => item.stock >= (ret.itemQuantity ?? 1)).map((item) => ({
                value: item.id, label: `${item.titleEn} (${item.stock})`,
              })) ?? []} />{' '}
            <Button loading={fulfillmentMutation.isPending} disabled={!replacementProductId}
              onClick={() => fulfillmentMutation.mutate('reserve')}>{t('sellerDetail.reserveReplacement')}</Button>
            {ret.fulfillment.refundProposalStatus === 'NONE' && <>
              <p>{t('sellerDetail.refundInstead')}</p>
              <Input.TextArea value={refundReason} onChange={(event) => setRefundReason(event.target.value)}
                maxLength={500} rows={2} />
              <Button loading={fulfillmentMutation.isPending} disabled={!refundReason.trim()}
                onClick={() => fulfillmentMutation.mutate('refund')}>{t('sellerDetail.proposeRefund')}</Button>
            </>}
          </div>}
        {ret.fulfillment.status === 'REPLACEMENT_PENDING' && ret.fulfillment.replacementProductId
          && !ret.shipments?.some((shipment) => shipment.leg === 'REPLACEMENT') &&
          <Button type="primary" loading={fulfillmentMutation.isPending}
            onClick={() => fulfillmentMutation.mutate('pack')}>{t('sellerDetail.packReplacement')}</Button>}
        {ret.fulfillment.status === 'REPLACEMENT_PACKED' &&
          !ret.shipments?.some((shipment) => shipment.leg === 'REPLACEMENT') &&
          <Button type="primary" loading={fulfillmentMutation.isPending}
            onClick={() => fulfillmentMutation.mutate('book')}>{t('sellerDetail.dispatchReplacement')}</Button>}
      </Card>}

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
