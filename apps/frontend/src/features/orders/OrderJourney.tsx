import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { OrderStatus } from '@karobarai/shared';
import { JOURNEY_STAGES, journeyIndex } from './journeyStages';

interface OrderJourneyProps {
  status: OrderStatus;
  /** `mini`: five dots for list rows; `full`: labelled tracker for the detail page. */
  variant?: 'mini' | 'full';
}

// The order's journey as a filled track. The fill and the current dot animate when the stage
// changes (a seller marking "packed" sees the line run to the next dot), and the current stage
// gently pulses until delivered. Purely visual — the stage name is given to assistive tech.
export function OrderJourney({ status, variant = 'full' }: OrderJourneyProps) {
  const { t } = useTranslation(['orders']);
  const index = journeyIndex(status);
  const cancelled = index < 0;
  const current = cancelled ? 0 : index;
  const progress = cancelled ? 0 : (current / (JOURNEY_STAGES.length - 1)) * 100;
  const currentLabel = cancelled ? t('journey.cancelled') : t(`journey.${JOURNEY_STAGES[current]}`);

  return (
    <div
      className="odJourney"
      data-variant={variant}
      data-cancelled={cancelled || undefined}
      role="img"
      aria-label={`${t('journey.label')}: ${currentLabel}`}
    >
      <div className="odTrack" aria-hidden="true">
        <span className="odTrackFill" style={{ inlineSize: `${progress}%` }} />
      </div>
      <ol className="odStops" aria-hidden="true">
        {JOURNEY_STAGES.map((stage, i) => {
          const state = cancelled ? undefined : i < current || current === 4 ? 'done' : i === current ? 'current' : undefined;
          return (
            <li key={stage} className="odStop" data-state={state}>
              <span className="odDot">
                {variant === 'full' && state === 'done' && <Check size={13} strokeWidth={3} />}
                {variant === 'full' && cancelled && i === 0 && <X size={13} strokeWidth={3} />}
              </span>
              {variant === 'full' && <span className="odStopLabel">{t(`journey.${stage}`)}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
