import { BadgeCheck, Banknote, RotateCcw, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// The trust strip (SCR-B01) — a white card straddling the bottom edge of the hero (pulled up with
// a negative margin), listing the four platform-level guarantees. Rendered as a real list so screen
// readers announce the four items; the icons are decorative. The same facts already ship as plain
// features elsewhere; this just surfaces them above the fold. Reserve-stock/returns specifics are
// product policy, not fabricated claims (rule K).
export function TrustStrip() {
  const { t } = useTranslation('marketplace');

  const items = [
    { key: 'cod', icon: Banknote, label: t('trust.cod'), sub: t('trust.codSub') },
    { key: 'tracking', icon: Truck, label: t('trust.tracking'), sub: t('trust.trackingSub') },
    { key: 'returns', icon: RotateCcw, label: t('trust.returns'), sub: t('trust.returnsSub') },
    { key: 'verified', icon: BadgeCheck, label: t('trust.verified'), sub: t('trust.verifiedSub') },
  ];

  return (
    <div className="trust">
      <ul className="trust__list">
        {items.map(({ key, icon: Icon, label, sub }) => (
          <li key={key} className="trust__item">
            <span className="trust__icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <span className="trust__text">
              <strong className="trust__label">{label}</strong>
              <small className="trust__sub">{sub}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
