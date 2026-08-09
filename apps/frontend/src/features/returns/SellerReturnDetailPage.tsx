import { useState } from 'react';
import { Alert, Button, Card, Input, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { Modal, SkeletonLoader, toast } from '../../components';
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
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !ret) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="error" showIcon message={formatReturnsError(t, error)} />
      </div>
    );
  }

  const canDecide = ret.status === 'MANUAL_REVIEW';

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('sellerDetail.title', { id: ret.orderId })}
        </Typography.Title>
        <ReturnStatusTag status={ret.status} />
      </div>

      <Card title={t('sellerDetail.reason')} style={{ marginTop: 16 }}>
        {ret.reason}
      </Card>

      <Card title={t('sellerDetail.photos')} style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {ret.images.map((img) => (
            <img
              key={img.id}
              src={img.cdnUrl}
              alt=""
              style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 4 }}
            />
          ))}
        </div>
      </Card>

      {canDecide && (
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
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
          <Typography.Text type="danger" style={{ display: 'block', marginTop: 4 }}>
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
