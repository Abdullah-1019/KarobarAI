import { useState } from 'react';
import { Alert, Button, Card, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { EmptyState, Modal, PageHeader, SkeletonLoader, toast } from '../../components';
import { getOrder, orderQueryKey } from '../orders/ordersApi';
import { ReturnProgressTimeline } from './ReturnProgressTimeline';
import { ReturnStatusTag } from './ReturnStatusTag';
import { appealReturn, buyerReturnsQueryKey, getReturn, listBuyerReturns, returnQueryKey } from './returnsApi';
import { formatReturnsError } from './returnsErrors';

// SCR-B11 — no GET /returns?orderId= filter exists on the backend (returnsApi.ts's own note), so
// this resolves the return tied to :id by matching it in the buyer's own (small, personal)
// history list first, then fetching the real detail by returnId. Keeps the documented route
// (/orders/:id/return/status) intact rather than restructuring around a return-id-keyed URL.
//
// The seller/admin's decision reason text is never persisted on the Return row or exposed on
// ReturnDetailDTO — it only ever reaches the buyer via the RETURN_DECISION notification message
// (decision.service.ts bakes `Reason: {reason}` into the notification, not the DB row). Rather
// than inventing a field that doesn't exist, this page points to the Notification Center instead.
export function ReturnStatusPage() {
  const { t } = useTranslation(['returns', 'orders']);
  const { id: orderId = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [appealModalOpen, setAppealModalOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: buyerReturnsQueryKey,
    queryFn: () => listBuyerReturns(),
  });

  const matchedItem = listQuery.data?.items.find((item) => item.orderId === orderId);

  const detailQuery = useQuery({
    queryKey: returnQueryKey(matchedItem?.id ?? ''),
    queryFn: () => getReturn(matchedItem!.id),
    enabled: !!matchedItem,
  });

  // Real order/product context (brief asks for "returned product" on this screen) — reuses the
  // same getOrder() call SellerReturnDetailPage/OrderDetailPage already make, not a new endpoint.
  const { data: order } = useQuery({
    queryKey: orderQueryKey(orderId),
    queryFn: () => getOrder(orderId),
    enabled: !!orderId,
  });

  const appealMutation = useMutation({
    mutationFn: () => appealReturn(matchedItem!.id),
    onSuccess: (data) => {
      queryClient.setQueryData(returnQueryKey(matchedItem!.id), data);
      toast.success(t('statusPage.appealed'));
      setAppealModalOpen(false);
    },
    onError: (err) => toast.error(formatReturnsError(t, err)),
  });

  if (listQuery.isPending || (matchedItem && detailQuery.isPending)) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Alert type="error" showIcon message={formatReturnsError(t, listQuery.error)} />
      </div>
    );
  }

  if (!matchedItem || !detailQuery.data) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <EmptyState title={t('statusPage.title')} description={t('statusPage.notFound')} />
      </div>
    );
  }

  const ret = detailQuery.data;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <PageHeader
        title={t('statusPage.title')}
        backTo={`/orders/${orderId}`}
        backLabel={t('orders:detail.title', { id: orderId })}
        actions={<ReturnStatusTag status={ret.status} />}
      />

      <Link to="/returns" style={{ display: 'inline-block', marginBottom: 'var(--sp-4)', fontSize: 'var(--fs-sm)' }}>
        {t('statusPage.viewAllReturns')}
      </Link>

      {order && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 'var(--sp-1)' }}>
            {t('statusPage.itemsLabel')}
          </Typography.Text>
          <ul style={{ margin: 0, paddingInlineStart: 'var(--sp-5)' }}>
            {order.items.map((item) => (
              <li key={item.productId}>{item.titleSnapshot}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          {t('statusPage.progressTitle')}
        </Typography.Title>
        <ReturnProgressTimeline ret={ret} />
      </Card>

      <Card>
        <Typography.Paragraph>
          <Typography.Text strong>{t('statusPage.reason')}: </Typography.Text>
          {ret.reason}
        </Typography.Paragraph>

        {ret.decision && (
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

        {ret.status === 'REJECTED' && (
          <Button danger onClick={() => setAppealModalOpen(true)}>
            {t('statusPage.appeal')}
          </Button>
        )}
      </Card>

      <Modal
        open={appealModalOpen}
        title={t('statusPage.appealConfirmTitle')}
        onCancel={() => setAppealModalOpen(false)}
        onOk={() => appealMutation.mutate()}
        confirmLoading={appealMutation.isPending}
      >
        {t('statusPage.appealConfirmContent')}
      </Modal>
    </div>
  );
}
