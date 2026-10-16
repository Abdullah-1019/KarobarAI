import { useState } from 'react';
import { Alert, Button, Card, Input, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { Modal, PageHeader, SkeletonLoader, toast } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { ReturnProgressTimeline } from '../returns/ReturnProgressTimeline';
import { ReturnStatusTag } from '../returns/ReturnStatusTag';
import { PrivateEvidenceImage } from '../returns/PrivateEvidenceImage';
import { ReturnSimilarityScale } from '../returns/ReturnSimilarityScale';
import { adminAdvanceReturnShipment, adminBookReturnCourier, adminDecideReturn,
  adminReturnDetailQueryKey, getAdminReturnDetail } from './adminApi';
import { formatAdminError } from './adminErrors';

// SCR-AD04's case detail + override panel. Unlike the Seller's own decision (optional reason on
// approve), `adminDecisionSchema` makes reason mandatory on BOTH approve and reject (BR-008 /
// REQ-F-Admin-003) — this is the final decision, so it always gets an audited reason. Admin-only
// write; Support gets the read-only case view (audit trail included, per Task 5.2).
export function AdminReturnDetailPage() {
  const { t } = useTranslation(['admin', 'returns']);
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [pendingDecision, setPendingDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [reason, setReason] = useState('');

  const { data: ret, isPending, isError, error } = useQuery({
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
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !ret) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Alert type="error" showIcon message={formatAdminError(t, error)} />
      </div>
    );
  }

  const canDecide = ret.status === 'MANUAL_REVIEW' || ret.status === 'UNDER_DISPUTE';

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <PageHeader
        title={ret.orderNumber ? `Order #${ret.orderNumber}` : t('returnDetail.title', { id: ret.orderId })}
        backTo="/admin/returns"
        backLabel={t('returnsQueue.title')}
        actions={<ReturnStatusTag status={ret.status} />}
      />

      <Card title={t('returnDetail.progressTitle')} style={{ marginBottom: 'var(--sp-4)' }}>
        <ReturnProgressTimeline ret={ret} />
      </Card>
      {ret.fulfillment?.status === 'REFUND_CONSENTED' && <Alert type="info" showIcon
        message={t('returnDetail.refundNeedsProcessing')} style={{ marginBottom: 'var(--sp-4)' }} />}
      {ret.inspection && <Card title={t('returns:sellerDetail.aiInspection')}
        style={{ marginBottom: 'var(--sp-4)' }}>
        <ReturnSimilarityScale inspection={ret.inspection} />
        <Typography.Text type="secondary">{t('returns:sellerDetail.aiAdvisory')}</Typography.Text>
      </Card>}
      {ret.status === 'APPROVED' && isAdmin && <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <Button type="primary" loading={courierMutation.isPending} onClick={() => courierMutation.mutate()}>
          {t('returnDetail.bookReturnCourier')}
        </Button>
        <Typography.Paragraph type="secondary">{t('returnDetail.simulatedOnly')}</Typography.Paragraph>
      </Card>}
      {ret.shipments?.map((shipment) => <Card key={shipment.leg}
        title={`${shipment.leg === 'RETURN' ? t('returnDetail.returnLeg') : t('returnDetail.replacementLeg')} · ${shipment.status}`}
        style={{ marginBottom: 'var(--sp-4)' }}>
        <Typography.Text>{t('returnDetail.simulatedOnly')}</Typography.Text>
        {shipment.courier && <p>{shipment.courier} · {shipment.trackingNumber}</p>}
        {isAdmin && ['BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(shipment.status)
          && <Button loading={trackingMutation.isPending} onClick={() => trackingMutation.mutate(shipment.leg)}>
            {t('returnDetail.advanceSimulatedTracking')}
          </Button>}
      </Card>)}

      <Card title={t('returnDetail.reason')} style={{ marginTop: 'var(--sp-4)' }}>
        {ret.reason}
      </Card>

      <Card title={t('returnDetail.photos')} style={{ marginTop: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
          {ret.images.map((img, index) => (
            <div key={img.id} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
              {ret.referenceImages[index] && <img src={ret.referenceImages[index].url}
                alt={t('returns:wizard.referenceAlt', { count: index + 1 })}
                style={{ width: 120, height: 120, objectFit: 'contain' }} />}
              <PrivateEvidenceImage url={img.cdnUrl} size={120} />
            </div>
          ))}
        </div>
      </Card>

      {ret.dispute && (
        <Card title={t('returnDetail.dispute')} style={{ marginTop: 'var(--sp-4)' }}>
          <Typography.Text>{t(`returnDetail.disputeStatus.${ret.dispute.status}`)}</Typography.Text>
          {ret.dispute.adminReason && <div>{ret.dispute.adminReason}</div>}
        </Card>
      )}

      {ret.auditTrail && ret.auditTrail.length > 0 && (
        <Card title={t('returnDetail.auditTrail')} style={{ marginTop: 'var(--sp-4)' }}>
          {ret.auditTrail.map((entry, i) => (
            <div key={i} style={{ marginBottom: 'var(--sp-2)' }}>
              <Typography.Text strong>{entry.action}</Typography.Text>
              {entry.reason && <Typography.Text> — {entry.reason}</Typography.Text>}
              <div>
                <Typography.Text type="secondary">{new Date(entry.createdAt).toLocaleString()}</Typography.Text>
              </div>
            </div>
          ))}
        </Card>
      )}

      {canDecide && isAdmin && (
        <>
          <Typography.Title level={5} style={{ marginBottom: 'var(--sp-2)', marginTop: 'var(--sp-6)' }}>
            {t('returnDetail.sectionActions')}
          </Typography.Title>
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <Button type="primary" onClick={() => setPendingDecision('APPROVED')}>
              {t('returnDetail.approve')}
            </Button>
            <Button danger onClick={() => setPendingDecision('REJECTED')}>
              {t('returnDetail.reject')}
            </Button>
          </div>
        </>
      )}

      {canDecide && !isAdmin && <Alert style={{ marginTop: 'var(--sp-6)' }} type="info" message={t('supportReadOnly')} />}

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
          maxLength={500}
          rows={3}
        />
      </Modal>
    </div>
  );
}
