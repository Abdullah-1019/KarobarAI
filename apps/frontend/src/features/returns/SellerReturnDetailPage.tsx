import { useState } from 'react';
import { Alert, Button, Card, Input, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { Modal, PageHeader, ProductThumbnail, SkeletonLoader, toast } from '../../components';
import { getOrder, orderQueryKey } from '../orders/ordersApi';
import { ReturnProgressTimeline } from './ReturnProgressTimeline';
import { ReturnStatusTag } from './ReturnStatusTag';
import { getSellerReturn, returnQueryKey, sellerDecideReturn, sellerEscalateReturn } from './returnsApi';
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
  const [rejectReason, setRejectReason] = useState('');
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);

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

  const decisionMutation = useMutation({
    mutationFn: (input: { decision: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      sellerDecideReturn(id, input.decision, input.reason),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(returnQueryKey(id), data);
      setRejectModalOpen(false);
      setRejectReason('');
      toast.success(variables.decision === 'APPROVED' ? t('sellerDetail.approved') : t('sellerDetail.rejected'));
    },
    onError: (err) => toast.error(formatReturnsError(t, err)),
  });

  const escalateMutation = useMutation({
    mutationFn: () => sellerEscalateReturn(id),
    onSuccess: () => {
      setEscalateModalOpen(false);
      toast.success(t('sellerDetail.escalated'));
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

  const canDecide = ret.status === 'MANUAL_REVIEW';

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <PageHeader
        title={t('sellerDetail.title', { id: ret.orderId })}
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
        {ret.reason}
      </Card>

      <Card title={t('sellerDetail.photos')} style={{ marginBottom: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
          {ret.images.map((img) => (
            <ProductThumbnail key={img.id} src={img.cdnUrl} size={120} />
          ))}
        </div>
      </Card>

      {canDecide && (
        <>
          <Typography.Title level={5} style={{ marginBottom: 'var(--sp-2)', marginTop: 'var(--sp-6)' }}>
            {t('sellerDetail.whatYouCanDoLabel')}
          </Typography.Title>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <Button
              type="primary"
              loading={decisionMutation.isPending}
              onClick={() => decisionMutation.mutate({ decision: 'APPROVED' })}
            >
              {t('sellerDetail.approve')}
            </Button>
            <Button danger onClick={() => setRejectModalOpen(true)}>
              {t('sellerDetail.reject')}
            </Button>
            <Button onClick={() => setEscalateModalOpen(true)}>{t('sellerDetail.escalate')}</Button>
          </div>
        </>
      )}

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

      <Modal
        open={escalateModalOpen}
        title={t('sellerDetail.escalateConfirmTitle')}
        onCancel={() => setEscalateModalOpen(false)}
        onOk={() => escalateMutation.mutate()}
        confirmLoading={escalateMutation.isPending}
      >
        {t('sellerDetail.escalateConfirmContent')}
      </Modal>
    </div>
  );
}
