import { useState } from 'react';
import { Alert, Button, Card, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { EmptyState, Modal, SkeletonLoader, toast } from '../../components';
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
  const { t } = useTranslation(['returns']);
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
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="error" showIcon message={formatReturnsError(t, listQuery.error)} />
      </div>
    );
  }

  if (!matchedItem || !detailQuery.data) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <EmptyState title={t('statusPage.title')} description={t('statusPage.notFound')} />
      </div>
    );
  }

  const ret = detailQuery.data;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('statusPage.title')}
        </Typography.Title>
        <ReturnStatusTag status={ret.status} />
      </div>

      <Card style={{ marginTop: 16 }}>
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
            style={{ marginBottom: 16 }}
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
