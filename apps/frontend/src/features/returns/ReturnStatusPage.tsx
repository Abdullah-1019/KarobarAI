import { useState } from 'react';
import { Alert, Button, Card, Input, Rate, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { EmptyState, Modal, PageHeader, SkeletonLoader, toast } from '../../components';
import { getOrder, orderQueryKey } from '../orders/ordersApi';
import { ReturnProgressTimeline } from './ReturnProgressTimeline';
import { ReturnStatusTag } from './ReturnStatusTag';
import { appealReturn, buyerReturnsQueryKey, getReturn, listBuyerReturns, returnQueryKey,
  respondToRefundProposal, confirmReplacementReceipt, submitExchangeFeedback } from './returnsApi';
import { formatReturnsError } from './returnsErrors';

// New links carry the exact return ID so separate items in one order open the right case.
// The original order-only URL still resolves through buyer history for older bookmarks.
//
// The seller/admin's decision reason text is never persisted on the Return row or exposed on
// ReturnDetailDTO — it only ever reaches the buyer via the RETURN_DECISION notification message
// (decision.service.ts bakes `Reason: {reason}` into the notification, not the DB row). Rather
// than inventing a field that doesn't exist, this page points to the Notification Center instead.
export function ReturnStatusPage() {
  const { t } = useTranslation(['returns', 'orders']);
  const { id: orderId = '', returnId } = useParams<{ id: string; returnId?: string }>();
  const queryClient = useQueryClient();
  const [appealModalOpen, setAppealModalOpen] = useState(false);
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

  // Real order/product context (brief asks for "returned product" on this screen) — reuses the
  // same getOrder() call SellerReturnDetailPage/OrderDetailPage already make, not a new endpoint.
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
      setAppealModalOpen(false);
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
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (!returnId && listQuery.isError) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Alert type="error" showIcon message={formatReturnsError(t, listQuery.error)} />
      </div>
    );
  }

  if (matchedReturnId && detailQuery.isError && !detailQuery.data) {
    return <Alert type="error" showIcon message={formatReturnsError(t, detailQuery.error)}
      action={<Button onClick={() => void detailQuery.refetch()}>{t('statusPage.refresh')}</Button>} />;
  }

  if (!matchedReturnId || !detailQuery.data || detailQuery.data.orderId !== orderId) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <EmptyState title={t('statusPage.title')} description={t('statusPage.notFound')} />
      </div>
    );
  }

  const ret = detailQuery.data;
  const currentStatus = ret.status === 'UNDER_AI_REVIEW' ? t('statusPage.pendingInspection')
    : ret.status === 'MANUAL_REVIEW' ? t('statusPage.awaitingSeller')
      : ret.status === 'APPROVED' ? t('statusPage.accepted')
        : ret.status === 'REJECTED' || (ret.status === 'CLOSED' && ret.decision === 'REJECTED')
          ? t('statusPage.rejected')
          : ret.status === 'PICKUP_BOOKED' ? t('statusPage.courierBooked') : null;
  const visibleStatus = ret.status === 'CLOSED' && ret.decision === 'REJECTED' ? 'REJECTED' : ret.status;
  const showReturnShipping = ['APPROVED', 'PICKUP_BOOKED', 'REFUND_ISSUED'].includes(ret.status);
  const hasReturnTracking = Boolean(ret.returnShipping && (
    ret.returnShipping.courier || ret.returnShipping.bookingReference || ret.returnShipping.trackingNumber
    || ret.returnShipping.trackingUrl || ret.returnShipping.estimatedPickupAt || ret.returnShipping.estimatedDeliveryAt
  ));

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <PageHeader
        title={t('statusPage.title')}
        backTo={`/orders/${orderId}`}
        backLabel={t('orders:detail.title', { id: orderId })}
        actions={<ReturnStatusTag status={visibleStatus} />}
      />

      <Link to="/returns" style={{ display: 'inline-block', marginBottom: 'var(--sp-4)', fontSize: 'var(--fs-sm)' }}>
        {t('statusPage.viewAllReturns')}
      </Link>

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <Typography.Title level={4} style={{ marginTop: 0 }}>{currentStatus ?? <ReturnStatusTag status={visibleStatus} />}</Typography.Title>
        {ret.decidedAt && <Typography.Paragraph>
          {t('statusPage.decidedAt', { date: new Date(ret.decidedAt).toLocaleString() })}
        </Typography.Paragraph>}
        <Button onClick={() => void detailQuery.refetch()} loading={detailQuery.isFetching}>
          {t('statusPage.refresh')}
        </Button>
        {detailQuery.isError && <Alert type="error" showIcon message={formatReturnsError(t, detailQuery.error)} />}
      </Card>

      {order && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 'var(--sp-1)' }}>
            {t('statusPage.itemsLabel')}
          </Typography.Text>
          <ul style={{ margin: 0, paddingInlineStart: 'var(--sp-5)' }}>
            {order.items.filter((item) => !ret.productId || item.productId === ret.productId).map((item) => (
              <li key={item.productId}>{item.titleSnapshot}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        {ret.inspection && <Alert type={ret.status === 'REJECTED' ? 'warning' : 'info'} showIcon
          message={ret.sellerOverrideReason ? t('statusPage.sellerOverrode', { reason: ret.sellerOverrideReason })
            : ret.decisionSource === 'AI' && ret.status === 'APPROVED' ? t('statusPage.aiAccepted')
              : ret.decisionSource === 'AI' && ret.status === 'REJECTED' ? t('statusPage.aiRejected')
                : ret.status === 'UNDER_AI_REVIEW' ? t('statusPage.inspectionPending')
                    : ret.status === 'MANUAL_REVIEW' ? t('statusPage.awaitingSeller')
                      : currentStatus ?? t('statusPage.inspectionManual')}
          style={{ marginBottom: 'var(--sp-3)' }} />}
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          {t('statusPage.progressTitle')}
        </Typography.Title>
        <ReturnProgressTimeline ret={ret} />
      </Card>

      <Card>
        {ret.decision === 'REJECTED' && ret.decisionReason && <Alert type="warning" showIcon
          message={t('statusPage.rejectionReason')}
          description={ret.decisionReason} style={{ marginBottom: 'var(--sp-4)' }} />}
        <Typography.Paragraph>
          <Typography.Text strong>{t('statusPage.reason')}: </Typography.Text>
          {ret.reason.startsWith('OTHER: ')
            ? `${t('reasons.OTHER')}: ${ret.reason.slice(7)}`
            : t(`reasons.${ret.reason}`, { defaultValue: ret.reason })}
        </Typography.Paragraph>

        {ret.decision && ret.decisionSource !== 'AI' && !ret.sellerOverrideReason && (
          <Alert
            type="info"
            showIcon
            message={t('statusPage.decisionReasonHint')}
            action={
              <Link to="/notifications">
                <Button size="small">{t('statusPage.viewNotifications')}</Button>
              </Link>
            }
            style={{ marginBottom: 'var(--sp-4)' }}
          />
        )}

        <Typography.Paragraph>
          <Typography.Text strong>{t('statusPage.refundStatus')}: </Typography.Text>
          {ret.refundStatus === 'ISSUED' ? t('statusPage.refundIssued') : t('statusPage.refundNotIssued')}
        </Typography.Paragraph>
        {ret.fulfillment?.refundProposalStatus === 'PENDING_BUYER' && <Alert type="info" showIcon
          message={t('statusPage.refundProposal')}
          description={<div>
            <p>{ret.fulfillment.refundProposalReason}</p>
            <Button type="primary" loading={refundResponseMutation.isPending}
              onClick={() => refundResponseMutation.mutate(true)}>{t('statusPage.acceptRefundProposal')}</Button>{' '}
            <Button loading={refundResponseMutation.isPending}
              onClick={() => refundResponseMutation.mutate(false)}>{t('statusPage.declineRefundProposal')}</Button>
          </div>} />}
        {ret.fulfillment?.refundProposalStatus === 'ACCEPTED' && <Alert type="info" showIcon
          message={t('statusPage.refundConsented')} />}
        {ret.fulfillment?.refundProposalStatus === 'DECLINED' && <Alert type="info" showIcon
          message={t('statusPage.refundDeclined')} />}

        {ret.status === 'REJECTED' && (
          <Button danger onClick={() => setAppealModalOpen(true)}>
            {t('statusPage.appeal')}
          </Button>
        )}
      </Card>

      {showReturnShipping && <Card title={t('statusPage.returnShippingTitle')} style={{ marginTop: 'var(--sp-4)' }}>
        {ret.returnShipping?.status === 'BOOKING_DETAILS_UNAVAILABLE'
          ? <Alert type="info" showIcon message={t('statusPage.bookingDetailsUnavailable')} />
          : hasReturnTracking
            ? <>
              {ret.returnShipping.courier && <Typography.Paragraph>{t('statusPage.courier')}: {ret.returnShipping.courier}</Typography.Paragraph>}
              {ret.returnShipping.bookingReference && <Typography.Paragraph>{t('statusPage.bookingReference')}: {ret.returnShipping.bookingReference}</Typography.Paragraph>}
              {ret.returnShipping.trackingNumber && <Typography.Paragraph>{t('statusPage.trackingNumber')}: {ret.returnShipping.trackingNumber}</Typography.Paragraph>}
              {ret.returnShipping.trackingUrl && <a href={ret.returnShipping.trackingUrl} target="_blank" rel="noreferrer">{t('statusPage.trackReturn')}</a>}
              {ret.returnShipping.estimatedPickupAt && <Typography.Paragraph>{t('statusPage.estimatedPickup')}: {new Date(ret.returnShipping.estimatedPickupAt).toLocaleString()}</Typography.Paragraph>}
              {ret.returnShipping.estimatedDeliveryAt && <Typography.Paragraph>{t('statusPage.simulatedEstimatedDelivery')}: {new Date(ret.returnShipping.estimatedDeliveryAt).toLocaleString()}</Typography.Paragraph>}
            </>
            : <Alert type="info" showIcon message={t('statusPage.courierNotBooked')} />}
      </Card>}
      {ret.shipments?.find((shipment) => shipment.leg === 'REPLACEMENT') &&
        <Card title={t('statusPage.replacementShippingTitle')} style={{ marginTop: 'var(--sp-4)' }}>
          {ret.shipments.filter((shipment) => shipment.leg === 'REPLACEMENT').map((shipment) =>
            <div key={shipment.leg}>
              <Typography.Paragraph>{t('statusPage.simulatedShipment')}: {shipment.status}</Typography.Paragraph>
              {shipment.courier && <Typography.Paragraph>{t('statusPage.courier')}: {shipment.courier}</Typography.Paragraph>}
              {shipment.trackingNumber && <Typography.Paragraph>{t('statusPage.trackingNumber')}: {shipment.trackingNumber}</Typography.Paragraph>}
              {shipment.estimatedDeliveryAt && <Typography.Paragraph>{t('statusPage.simulatedEstimatedDelivery')}: {new Date(shipment.estimatedDeliveryAt).toLocaleString()}</Typography.Paragraph>}
              {shipment.events.map((event) => <p key={event.eventTime}>{event.description} · {new Date(event.eventTime).toLocaleString()}</p>)}
            </div>)}
        </Card>}
      {ret.fulfillment?.status === 'REPLACEMENT_DELIVERED' && <Card style={{ marginTop: 'var(--sp-4)' }}>
        <Alert type="info" showIcon message={t('statusPage.replacementAwaitingConfirmation')} />
        <Button type="primary" style={{ marginTop: 'var(--sp-3)' }}
          loading={replacementReceiptMutation.isPending}
          onClick={() => replacementReceiptMutation.mutate()}>
          {t('statusPage.confirmReplacementReceipt')}
        </Button>
      </Card>}
      {ret.fulfillment?.status === 'EXCHANGE_COMPLETED' && <Card
        title={t('statusPage.feedbackTitle')} style={{ marginTop: 'var(--sp-4)' }}>
        {ret.exchangeFeedback ? <Typography.Paragraph>
          {t('statusPage.feedbackSubmitted', { rating: ret.exchangeFeedback.rating })}
        </Typography.Paragraph> : <>
          <Typography.Paragraph>{t('statusPage.feedbackPrompt')}</Typography.Paragraph>
          <Rate value={feedbackRating} onChange={setFeedbackRating} aria-label={t('statusPage.feedbackRating')} />
          <Input.TextArea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)}
            maxLength={1000} rows={3} style={{ marginTop: 'var(--sp-3)' }}
            aria-label={t('statusPage.feedbackComment')} />
          <Button type="primary" style={{ marginTop: 'var(--sp-3)' }} disabled={feedbackRating < 1}
            loading={feedbackMutation.isPending} onClick={() => feedbackMutation.mutate()}>
            {t('statusPage.submitFeedback')}
          </Button>
        </>}
      </Card>}

      <Modal
        open={appealModalOpen}
        title={t('statusPage.appealConfirmTitle')}
        onCancel={() => setAppealModalOpen(false)}
        onOk={() => appealMutation.mutate()}
        confirmLoading={appealMutation.isPending}
        okButtonProps={{ disabled: !appealReason.trim() }}
      >
        <p>{t('statusPage.appealConfirmContent')}</p>
        <Input.TextArea value={appealReason} onChange={(event) => setAppealReason(event.target.value)}
          maxLength={500} rows={3} aria-label={t('statusPage.appealReason')} />
      </Modal>
    </div>
  );
}
