import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, Input, InputNumber } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Info, Lock, Percent, Scale, ShoppingBag, Truck, Undo2, type LucideIcon } from 'lucide-react';
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
const EMPTY_WEIGHTS: CourierWeights = { cost: 0, time: 0, reliability: 0, coverage: 0 };

interface SettingProps {
  icon: LucideIcon;
  title: string;
  help: string;
  saved: string;
  dirty: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

function Setting({ icon: Icon, title, help, saved, dirty, children, footer }: SettingProps) {
  const { t } = useTranslation(['admin']);
  return (
    <article className="cfSetting" data-dirty={dirty || undefined}>
      <span className="cfIcon" aria-hidden="true"><Icon size={18} /></span>
      <div className="cfBody">
        <div className="cfTitleRow">
          <h3 className="cfTitle">{title}</h3>
          {dirty && <span className="cfDirty">{t('config.unsaved')}</span>}
        </div>
        <p className="cfHelp">{help}</p>
        <div className="cfControl">{children}</div>
        <p className="cfSaved">{saved}</p>
        {footer}
      </div>
    </article>
  );
}

// SCR-AD06 — one setting per platform_config key, grouped (money / delivery + returns / AI).
// Every write needs a reason (it lands in the audit history), so the reason field and Save only
// appear once a value actually differs from what is saved. `returns_confidence_threshold` stays
// read-only: its consuming automation (R1.1) isn't built, and the backend rejects any PATCH with
// 403 CONFIG_KEY_NOT_WRITABLE before this UI's own check. Support sees values, no inputs.
export function ConfigPanelPage() {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: adminConfigQueryKey, queryFn: listAdminConfig });

  const [commissionRate, setCommissionRate] = useState<number | null>(null);
  const [weights, setWeights] = useState<CourierWeights>(EMPTY_WEIGHTS);
  const [returnWindowDays, setReturnWindowDays] = useState<number | null>(null);
  const [minOrderValue, setMinOrderValue] = useState<number | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const savedValue = (key: string) => data?.items.find((entry) => entry.key === key)?.value;

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
      <div className="adPage cfPage">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="adPage cfPage">
        <Alert type="error" showIcon message={formatAdminError(t, error)}
          action={<Button size="small" shape="round" onClick={() => void refetch()}>{t('common:actions.retry')}</Button>} />
      </div>
    );
  }

  const confidenceEntry = data.items.find((e) => e.key === 'returns_confidence_threshold');
  const weightsSum = COURIER_WEIGHT_KEYS.reduce((acc, k) => acc + (weights[k] ?? 0), 0);
  const weightsValid = Math.abs(weightsSum - 1) <= 0.001;
  const savedWeights = (savedValue('courier_weights') as CourierWeights | undefined) ?? EMPTY_WEIGHTS;

  const dirty = {
    commission_rate_default: commissionRate !== savedValue('commission_rate_default'),
    courier_weights: COURIER_WEIGHT_KEYS.some((k) => weights[k] !== savedWeights[k]),
    return_window_days: returnWindowDays !== savedValue('return_window_days'),
    min_order_value_pkr: minOrderValue !== savedValue('min_order_value_pkr'),
  };

  const pct = (value: unknown) => `${((Number(value) || 0) * 100).toFixed(1)}%`;

  function saveBar(key: keyof typeof dirty, value: unknown, valid = true) {
    if (!isAdmin || !dirty[key]) return null;
    const reason = reasons[key] ?? '';
    return (
      <div className="cfSave">
        <Input
          placeholder={t('config.reasonRequired')}
          aria-label={t('config.reasonRequired')}
          value={reason}
          onChange={(e) => setReasons((prev) => ({ ...prev, [key]: e.target.value }))}
          maxLength={500}
        />
        <Button type="primary" shape="round" loading={patchMutation.isPending && patchMutation.variables?.key === key}
          disabled={value === null || !valid || !reason.trim()}
          onClick={() => patchMutation.mutate({ key, value, reason: reason.trim() })}>
          {t('config.save')}
        </Button>
      </div>
    );
  }

  return (
    <div className="adPage cfPage">
      <header className="adHead">
        <h1 className="adTitle">{t('config.title')}</h1>
        <p className="adSub">{t('config.subtitle')}</p>
      </header>

      {!isAdmin && <p className="adNote"><Info size={15} aria-hidden="true" /> {t('config.readOnlyNote')}</p>}

      <section className="cfGroup">
        <h2 className="cfGroupTitle">{t('config.sectionMoney')}</h2>
        <Setting icon={Percent} title={t('config.commissionRateTitle')} help={t('config.commissionRateHelp')}
          saved={t('config.current', { value: pct(savedValue('commission_rate_default')) })}
          dirty={dirty.commission_rate_default} footer={saveBar('commission_rate_default', commissionRate)}>
          <InputNumber
            disabled={!isAdmin}
            min={0}
            max={1}
            step={0.01}
            className="cfNumber"
            aria-label={t('config.commissionRateTitle')}
            value={commissionRate}
            onChange={(v) => setCommissionRate(v)}
            formatter={(v) => `${((Number(v) || 0) * 100).toFixed(1)}%`}
            parser={(v) => (Number((v ?? '').replace('%', '')) / 100) as unknown as number}
          />
        </Setting>
        <Setting icon={ShoppingBag} title={t('config.minOrderValueTitle')} help={t('config.minOrderValueHelp')}
          saved={t('config.current', { value: `Rs ${Number(savedValue('min_order_value_pkr') ?? 0).toLocaleString()}` })}
          dirty={dirty.min_order_value_pkr} footer={saveBar('min_order_value_pkr', minOrderValue)}>
          <InputNumber
            disabled={!isAdmin}
            min={0}
            step={10}
            className="cfNumber"
            aria-label={t('config.minOrderValueTitle')}
            value={minOrderValue}
            onChange={(v) => setMinOrderValue(v)}
            addonBefore="Rs"
          />
        </Setting>
      </section>

      <section className="cfGroup">
        <h2 className="cfGroupTitle">{t('config.sectionDelivery')}</h2>
        <Setting icon={Truck} title={t('config.courierWeightsTitle')} help={t('config.courierWeightsHelp')}
          saved={t('config.current', { value: COURIER_WEIGHT_KEYS.map((k) => `${t(`config.weight.${k}`)} ${savedWeights[k]}`).join(' · ') })}
          dirty={dirty.courier_weights} footer={saveBar('courier_weights', weights, weightsValid)}>
          <div className="cfWeights">
            {COURIER_WEIGHT_KEYS.map((k, i) => (
              <label key={k} className="cfWeight">
                <span><i className="cfSwatch" data-slot={i} aria-hidden="true" />{t(`config.weight.${k}`)}</span>
                <InputNumber
                  disabled={!isAdmin}
                  min={0}
                  max={1}
                  step={0.05}
                  value={weights[k]}
                  onChange={(v) => setWeights((prev) => ({ ...prev, [k]: v ?? 0 }))}
                />
              </label>
            ))}
          </div>
          <div className="cfMix" aria-hidden="true">
            {COURIER_WEIGHT_KEYS.map((k, i) => (
              <span key={k} data-slot={i} style={{ flexGrow: Math.max(weights[k], 0) }} />
            ))}
          </div>
          <p className="cfSum" data-ok={weightsValid || undefined} role="status">
            <Scale size={14} aria-hidden="true" /> {t('config.weightsSum', { sum: weightsSum.toFixed(2) })}
          </p>
        </Setting>
        <Setting icon={Undo2} title={t('config.returnWindowTitle')} help={t('config.returnWindowHelp')}
          saved={t('config.current', { value: `${savedValue('return_window_days') ?? '—'} ${t('config.days')}` })}
          dirty={dirty.return_window_days} footer={saveBar('return_window_days', returnWindowDays)}>
          <InputNumber
            disabled={!isAdmin}
            min={1}
            step={1}
            className="cfNumber"
            aria-label={t('config.returnWindowTitle')}
            value={returnWindowDays}
            onChange={(v) => setReturnWindowDays(v)}
            addonAfter={t('config.days')}
          />
        </Setting>
      </section>

      {confidenceEntry && (
        <section className="cfGroup">
          <h2 className="cfGroupTitle">{t('config.sectionAi')}</h2>
          <Setting icon={Bot} title={t('config.confidenceThresholdTitle')} help={t('config.confidenceThresholdHelp')}
            saved={t('config.current', { value: String(confidenceEntry.value) })} dirty={false}>
            <span className="cfLocked"><Lock size={13} aria-hidden="true" /> {t('config.readOnly')}</span>
          </Setting>
        </section>
      )}
    </div>
  );
}
