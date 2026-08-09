import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Input, InputNumber, Row, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SkeletonLoader, toast } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { adminConfigQueryKey, listAdminConfig, patchAdminConfig } from './adminApi';
import { formatAdminError } from './adminErrors';

interface CourierWeights {
  cost: number;
  time: number;
  reliability: number;
  coverage: number;
}

const COURIER_WEIGHT_KEYS: (keyof CourierWeights)[] = ['cost', 'time', 'reliability', 'coverage'];

// SCR-AD06 — one form section per platform_config key (Task 6). `returns_confidence_threshold`
// is deliberately read-only — its consuming feature (R1.1 ReturnsAI automation) isn't built yet,
// so the backend rejects any PATCH to it with 403 CONFIG_KEY_NOT_WRITABLE even before this UI's
// own `writable` check kicks in.
export function ConfigPanelPage() {
  const { t } = useTranslation(['admin']);
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const { data, isPending, isError, error } = useQuery({ queryKey: adminConfigQueryKey, queryFn: listAdminConfig });

  const [commissionRate, setCommissionRate] = useState<number | null>(null);
  const [weights, setWeights] = useState<CourierWeights>({ cost: 0, time: 0, reliability: 0, coverage: 0 });
  const [returnWindowDays, setReturnWindowDays] = useState<number | null>(null);
  const [minOrderValue, setMinOrderValue] = useState<number | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    for (const entry of data.items) {
      if (entry.key === 'commission_rate_default') setCommissionRate(entry.value as number);
      if (entry.key === 'courier_weights') setWeights(entry.value as CourierWeights);
      if (entry.key === 'return_window_days') setReturnWindowDays(entry.value as number);
      if (entry.key === 'min_order_value_pkr') setMinOrderValue(entry.value as number);
    }
  }, [data]);

  const patchMutation = useMutation({
    mutationFn: (input: { key: string; value: unknown; reason: string }) => patchAdminConfig(input.key, input.value, input.reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adminConfigQueryKey });
      setReasons((prev) => ({ ...prev, [variables.key]: '' }));
      toast.success(t('config.saved'));
    },
    onError: (err) => toast.error(formatAdminError(t, err)),
  });

  if (isPending) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="error" showIcon message={formatAdminError(t, error)} />
      </div>
    );
  }

  const confidenceEntry = data.items.find((e) => e.key === 'returns_confidence_threshold');
  const weightsSum = COURIER_WEIGHT_KEYS.reduce((acc, k) => acc + (weights[k] ?? 0), 0);

  function saveSection(key: string, value: unknown) {
    const reason = (reasons[key] ?? '').trim();
    if (!reason) return;
    patchMutation.mutate({ key, value, reason });
  }

  function reasonField(key: string) {
    return (
      <Input
        placeholder={t('config.reasonRequired')}
        value={reasons[key] ?? ''}
        onChange={(e) => setReasons((prev) => ({ ...prev, [key]: e.target.value }))}
        maxLength={500}
        style={{ marginTop: 8 }}
      />
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('config.title')}</Typography.Title>

      {!isAdmin && <Alert style={{ marginBottom: 16 }} type="info" message={t('supportReadOnly')} />}

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card title={t('config.commissionRateTitle')}>
          <Typography.Text type="secondary">{t('config.commissionRateHelp')}</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <InputNumber
              disabled={!isAdmin}
              min={0}
              max={1}
              step={0.01}
              style={{ width: 160 }}
              value={commissionRate}
              onChange={(v) => setCommissionRate(v)}
              formatter={(v) => `${((Number(v) || 0) * 100).toFixed(1)}%`}
              parser={(v) => (Number((v ?? '').replace('%', '')) / 100) as unknown as number}
            />
          </div>
          {isAdmin && reasonField('commission_rate_default')}
          {isAdmin && (
            <Button
              style={{ marginTop: 8 }}
              type="primary"
              loading={patchMutation.isPending}
              disabled={commissionRate === null || !(reasons.commission_rate_default ?? '').trim()}
              onClick={() => saveSection('commission_rate_default', commissionRate)}
            >
              {t('config.save')}
            </Button>
          )}
        </Card>

        <Card title={t('config.courierWeightsTitle')}>
          <Typography.Text type="secondary">{t('config.courierWeightsHelp')}</Typography.Text>
          <Row gutter={12} style={{ marginTop: 8 }}>
            {COURIER_WEIGHT_KEYS.map((k) => (
              <Col key={k} span={6}>
                <Typography.Text>{t(`config.weight.${k}`)}</Typography.Text>
                <InputNumber
                  disabled={!isAdmin}
                  min={0}
                  max={1}
                  step={0.01}
                  style={{ width: '100%' }}
                  value={weights[k]}
                  onChange={(v) => setWeights((prev) => ({ ...prev, [k]: v ?? 0 }))}
                />
              </Col>
            ))}
          </Row>
          <Typography.Text type={Math.abs(weightsSum - 1) > 0.001 ? 'danger' : 'success'} style={{ display: 'block', marginTop: 8 }}>
            {t('config.weightsSum', { sum: weightsSum.toFixed(2) })}
          </Typography.Text>
          {isAdmin && reasonField('courier_weights')}
          {isAdmin && (
            <Button
              style={{ marginTop: 8 }}
              type="primary"
              loading={patchMutation.isPending}
              disabled={Math.abs(weightsSum - 1) > 0.001 || !(reasons.courier_weights ?? '').trim()}
              onClick={() => saveSection('courier_weights', weights)}
            >
              {t('config.save')}
            </Button>
          )}
        </Card>

        <Card title={t('config.returnWindowTitle')}>
          <Typography.Text type="secondary">{t('config.returnWindowHelp')}</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <InputNumber
              disabled={!isAdmin}
              min={1}
              step={1}
              style={{ width: 160 }}
              value={returnWindowDays}
              onChange={(v) => setReturnWindowDays(v)}
              addonAfter={t('config.days')}
            />
          </div>
          {isAdmin && reasonField('return_window_days')}
          {isAdmin && (
            <Button
              style={{ marginTop: 8 }}
              type="primary"
              loading={patchMutation.isPending}
              disabled={returnWindowDays === null || !(reasons.return_window_days ?? '').trim()}
              onClick={() => saveSection('return_window_days', returnWindowDays)}
            >
              {t('config.save')}
            </Button>
          )}
        </Card>

        <Card title={t('config.minOrderValueTitle')}>
          <Typography.Text type="secondary">{t('config.minOrderValueHelp')}</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <InputNumber
              disabled={!isAdmin}
              min={0}
              step={10}
              style={{ width: 160 }}
              value={minOrderValue}
              onChange={(v) => setMinOrderValue(v)}
              addonBefore="Rs."
            />
          </div>
          {isAdmin && reasonField('min_order_value_pkr')}
          {isAdmin && (
            <Button
              style={{ marginTop: 8 }}
              type="primary"
              loading={patchMutation.isPending}
              disabled={minOrderValue === null || !(reasons.min_order_value_pkr ?? '').trim()}
              onClick={() => saveSection('min_order_value_pkr', minOrderValue)}
            >
              {t('config.save')}
            </Button>
          )}
        </Card>

        {confidenceEntry && (
          <Card title={t('config.confidenceThresholdTitle')}>
            <Space direction="vertical">
              <Tag>{t('config.readOnly')}</Tag>
              <Typography.Text type="secondary">{t('config.confidenceThresholdHelp')}</Typography.Text>
              <Typography.Text strong>{String(confidenceEntry.value)}</Typography.Text>
            </Space>
          </Card>
        )}
      </Space>
    </div>
  );
}
