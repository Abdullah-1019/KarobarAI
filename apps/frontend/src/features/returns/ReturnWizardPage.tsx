import { useState } from 'react';
import { Alert, Button, Card, Input, Radio, Space, Steps, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import type { ReturnDetailDTO } from '@karobarai/shared';
import { PageHeader, ProductThumbnail } from '../../components';
import { getOrder, orderQueryKey } from '../orders/ordersApi';
import { ReturnImageUploader } from './ReturnImageUploader';
import { createReturn, submitReturn } from './returnsApi';
import { formatReturnsError } from './returnsErrors';

const REASON_KEYS = ['WRONG_ITEM', 'DAMAGED', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'OTHER'] as const;
type ReasonKey = (typeof REASON_KEYS)[number];

// SCR-B10 — the return record is created (Step 1 -> 2, via createReturn) as soon as a reason is
// picked, since POST /returns requires {orderId, reason} together — there's no "empty" return to
// create earlier. That's also the earliest point eligibility (RETURN_WINDOW_CLOSED,
// RETURN_ALREADY_EXISTS) can be checked server-side; Step 0 is purely informational, no call.
export function ReturnWizardPage() {
  const { t } = useTranslation(['returns', 'orders']);
  const navigate = useNavigate();
  const { id: orderId = '' } = useParams<{ id: string }>();

  const [step, setStep] = useState(0);
  const [reasonKey, setReasonKey] = useState<ReasonKey | null>(null);
  const [otherReason, setOtherReason] = useState('');
  const [returnRecord, setReturnRecord] = useState<ReturnDetailDTO | null>(null);
  const [blockedError, setBlockedError] = useState<string | null>(null);

  // Real product context (brief: "return process should feel simple and reassuring" — knowing
  // exactly what you're returning, not just an order number, is part of that) — reuses the same
  // getOrder() call used elsewhere, no new endpoint.
  const { data: order } = useQuery({ queryKey: orderQueryKey(orderId), queryFn: () => getOrder(orderId), enabled: !!orderId });

  const reasonText = reasonKey === 'OTHER' ? otherReason.trim() : reasonKey ? t(`reasons.${reasonKey}`) : '';

  const createMutation = useMutation({
    mutationFn: () => createReturn(orderId, reasonText),
    onSuccess: (data) => {
      setReturnRecord(data);
      setBlockedError(null);
      setStep(2);
    },
    onError: (err) => setBlockedError(formatReturnsError(t, err)),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitReturn(returnRecord!.id),
    onSuccess: () => navigate(`/orders/${orderId}/return/status`),
    onError: (err) => setBlockedError(formatReturnsError(t, err)),
  });

  const imageCount = returnRecord?.images.length ?? 0;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <PageHeader title={t('wizard.title')} backTo={`/orders/${orderId}`} backLabel={t('orders:detail.title', { id: orderId })} />

      {order && (
        <Card style={{ marginBottom: 'var(--sp-4)' }} styles={{ body: { padding: 'var(--sp-3) var(--sp-4)' } }}>
          <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
            {t('statusPage.itemsLabel')}
          </Typography.Text>
          {order.items.map((item) => (
            <div key={item.productId}>{item.titleSnapshot}</div>
          ))}
        </Card>
      )}

      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 'var(--sp-6)' }}
        items={[
          { title: t('wizard.stepEligibility') },
          { title: t('wizard.stepReason') },
          { title: t('wizard.stepPhotos') },
          { title: t('wizard.stepReview') },
        ]}
      />

      {blockedError && (
        <Alert
          type="error"
          showIcon
          message={t('wizard.blockedTitle')}
          description={blockedError}
          style={{ marginBottom: 'var(--sp-4)' }}
        />
      )}

      {step === 0 && (
        <Card>
          <Typography.Paragraph>{t('wizard.eligibilityIntro')}</Typography.Paragraph>
          <Button type="primary" onClick={() => setStep(1)}>
            {t('wizard.next')}
          </Button>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <Typography.Paragraph strong>{t('wizard.reasonLabel')}</Typography.Paragraph>
          <Radio.Group value={reasonKey} onChange={(e) => setReasonKey(e.target.value as ReasonKey)}>
            <Space direction="vertical">
              {REASON_KEYS.map((key) => (
                <Radio key={key} value={key}>
                  {t(`reasons.${key}`)}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
          {reasonKey === 'OTHER' && (
            <Input.TextArea
              style={{ marginTop: 'var(--sp-3)' }}
              placeholder={t('wizard.otherReasonLabel')}
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              maxLength={200}
              rows={3}
            />
          )}
          <div style={{ marginTop: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-2)' }}>
            <Button onClick={() => setStep(0)}>{t('wizard.back')}</Button>
            <Button
              type="primary"
              loading={createMutation.isPending}
              disabled={!reasonText}
              onClick={() => createMutation.mutate()}
            >
              {t('wizard.next')}
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && returnRecord && (
        <Card>
          <ReturnImageUploader
            returnId={returnRecord.id}
            images={returnRecord.images}
            onChange={(images) => setReturnRecord((prev) => (prev ? { ...prev, images } : prev))}
          />
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <Button type="primary" disabled={imageCount < 3} onClick={() => setStep(3)}>
              {t('wizard.next')}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && returnRecord && (
        <Card>
          <Typography.Paragraph>{t('wizard.reviewIntro')}</Typography.Paragraph>
          <Typography.Paragraph>
            <Typography.Text strong>{t('wizard.reviewReason')}: </Typography.Text>
            {returnRecord.reason}
          </Typography.Paragraph>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
            {returnRecord.images.map((img) => (
              <ProductThumbnail key={img.id} src={img.cdnUrl} size={80} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Button onClick={() => setStep(2)}>{t('wizard.back')}</Button>
            <Button type="primary" loading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
              {submitMutation.isPending ? t('wizard.submitting') : t('wizard.submit')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
