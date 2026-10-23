import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ReturnDetailDTO } from '@karobarai/shared';
import { buildSteps } from './returnSteps';

// The return's steps as a filled track for the seller detail band — same step logic as
// ReturnProgressTimeline (buyer status page, admin), drawn like the order journey. The number of
// steps varies (rejected returns stop at the decision; exchanges run longer), so the track is a
// flexible row on wide screens and a vertical list on phones.
export function ReturnJourney({ ret }: { ret: ReturnDetailDTO }) {
  const { t } = useTranslation(['returns']);
  const steps = buildSteps(ret);
  const currentIndex = steps.findIndex((s) => s.state === 'current');
  const reached = currentIndex < 0 ? steps.length - 1 : currentIndex;
  const progress = steps.length > 1 ? (reached / (steps.length - 1)) * 100 : 100;
  const rejected = ret.decision === 'REJECTED';
  const current = steps[reached];

  return (
    <div
      className="rtJourney"
      data-rejected={rejected || undefined}
      role="img"
      aria-label={current ? t(current.labelKey) : undefined}
      style={{ ['--rt-steps' as string]: steps.length }}
    >
      <div className="rtTrack" aria-hidden="true">
        <span className="rtTrackFill" style={{ ['--rt-progress' as string]: `${progress}%` }} />
      </div>
      <ol className="rtStops" aria-hidden="true">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.key} className="rtStop" data-state={step.state}>
              <span className="rtDot">{step.state === 'done' ? <Check size={13} strokeWidth={3} /> : <Icon size={12} />}</span>
              <span className="rtStopText">
                <span className="rtStopLabel">{t(step.labelKey)}</span>
                {step.timestamp && step.state !== 'upcoming' && (
                  <span className="rtStopTime">{new Date(step.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
