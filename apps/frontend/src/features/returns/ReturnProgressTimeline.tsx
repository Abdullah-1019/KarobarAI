import type { ReturnDetailDTO } from '@karobarai/shared';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { buildSteps } from './returnSteps';

interface ReturnProgressTimelineProps {
  ret: ReturnDetailDTO;
}

export function ReturnProgressTimeline({ ret }: ReturnProgressTimelineProps) {
  const { t } = useTranslation(['returns']);
  const steps = buildSteps(ret);

  return (
    <div>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isDone = step.state === 'done';
        const isCurrent = step.state === 'current';
        const color = isDone ? 'var(--success)' : isCurrent ? 'var(--brand-primary)' : 'var(--text-disabled)';
        return (
          <div key={step.key} style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: isCurrent ? 32 : 24,
                  height: isCurrent ? 32 : 24,
                  borderRadius: '50%',
                  background: isDone || isCurrent ? color : 'transparent',
                  border: isDone || isCurrent ? 'none' : '2px solid var(--border)',
                  color: isDone || isCurrent ? 'var(--bg-surface)' : 'var(--text-disabled)',
                  flexShrink: 0,
                }}
              >
                <Icon size={isCurrent ? 18 : isDone ? 14 : 10} aria-hidden="true" />
              </span>
              {index < steps.length - 1 && (
                <span style={{ width: 2, flex: 1, minHeight: 'var(--sp-4)', background: 'var(--border)' }} aria-hidden="true" />
              )}
            </div>
            <div style={{ paddingBottom: 'var(--sp-4)' }}>
              <Typography.Text
                strong={isCurrent}
                type={step.state === 'upcoming' ? 'secondary' : undefined}
                style={{ fontSize: isCurrent ? 'var(--fs-base)' : 'var(--fs-sm)' }}
              >
                {t(step.labelKey)}
              </Typography.Text>
              {step.timestamp && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 'var(--fs-xs)' }}>
                    {new Date(step.timestamp).toLocaleString()}
                  </Typography.Text>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
