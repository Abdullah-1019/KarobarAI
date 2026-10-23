import { CheckCircle2, Eye, ScanSearch, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ReturnDetailDTO } from '@karobarai/shared';
import { useCountUp } from '../analytics/useCountUp';

type Inspection = NonNullable<ReturnDetailDTO['inspection']>;

const CX = 120;
const CY = 120;
const R = 94;

// Point on the half circle for a 0–1 fraction (0 = far left, 1 = far right).
function point(f: number): string {
  const angle = Math.PI * (1 - f);
  return `${(CX + R * Math.cos(angle)).toFixed(2)} ${(CY - R * Math.sin(angle)).toFixed(2)}`;
}
function arc(from: number, to: number): string {
  return `M ${point(from)} A ${R} ${R} 0 0 1 ${point(to)}`;
}
function asFraction(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return value > 1 ? value / 100 : value;
}

// The seller detail page's AI moment: one stored visual-similarity observation drawn as a half
// gauge with the policy's three zones; the needle swings to the score and the figure counts up.
// Same data and caveats as ReturnSimilarityScale (kept for admin) — a similarity indicator, not a
// probability or proof of identity, so the copy says "match", never "confidence".
export function ReturnSimilarityGauge({ inspection }: { inspection: Inspection }) {
  const { t } = useTranslation(['returns']);
  const score = inspection.similarityScore;
  const hasScore = score != null && Number.isFinite(score);
  const value = hasScore ? Math.max(0, Math.min(1, score)) : 0;
  const shown = useCountUp(value * 100, 1100);
  const review = asFraction(inspection.aiDecision?.reviewThreshold, 0.6);
  const accept = asFraction(inspection.aiDecision?.acceptThreshold, 0.8);
  const zone = value >= accept ? 'accept' : value >= review ? 'review' : 'reject';
  const gap = 0.006;

  if (!hasScore) {
    return (
      <div className="rtGaugeNone">
        <span className="rtGaugeNoneIcon" aria-hidden="true">
          <ScanSearch size={20} />
        </span>
        <p>
          {inspection.reasonCode
            ? t(`sellerDetail.inspectionValues.${inspection.reasonCode}`, { defaultValue: t('gauge.noScore') })
            : t('gauge.noScore')}
        </p>
      </div>
    );
  }

  const ZoneIcon = zone === 'accept' ? CheckCircle2 : zone === 'review' ? Eye : TriangleAlert;

  return (
    <div className="rtGauge" data-zone={zone}>
      <div className="rtGaugeDial" role="img" aria-label={t('similarityScale.aria', { score: (value * 100).toFixed(1) })}>
        <svg viewBox="0 0 240 132" aria-hidden="true">
          <path d={arc(0, review - gap)} className="rtZone rtZone--reject" />
          <path d={arc(review + gap, accept - gap)} className="rtZone rtZone--review" />
          <path d={arc(accept + gap, 1)} className="rtZone rtZone--accept" />
          <g className="rtNeedle" style={{ ['--rt-angle' as string]: `${value * 180}deg` }}>
            <line x1={CX} y1={CY} x2={CX - R + 22} y2={CY} />
            <circle cx={CX} cy={CY} r={7} />
          </g>
        </svg>
        <div className="rtGaugeRead">
          <span className="rtGaugeNum">{shown.toFixed(1)}%</span>
          <span className="rtGaugeCap">{t('gauge.match')}</span>
        </div>
      </div>

      <p className="rtGaugeVerdict">
        <ZoneIcon size={16} aria-hidden="true" />
        {t(`gauge.zone.${zone}`)}
      </p>

      <ul className="rtGaugeLegend">
        <li data-zone="reject">
          <span aria-hidden="true" />
          {t('similarityScale.reject')} &lt;{Math.round(review * 100)}%
        </li>
        <li data-zone="review">
          <span aria-hidden="true" />
          {t('similarityScale.review')}
        </li>
        <li data-zone="accept">
          <span aria-hidden="true" />
          {t('similarityScale.accept')} ≥{Math.round(accept * 100)}%
        </li>
      </ul>
    </div>
  );
}
