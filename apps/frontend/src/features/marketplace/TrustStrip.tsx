import { Banknote, Languages, RotateCcw, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// The trust row (SCR-B01), under the hero: four platform facts as four light cards, each with its
// icon on a different wash tint (the sample Home design). Only things the platform really does:
// cash on delivery, courier tracking, photo-backed returns within the policy window, and shopping
// in Urdu or English. ("Verified sellers" was dropped: the product data carries no seller
// verification, so the claim could not be shown anywhere it matters.) A real list, so screen
// readers announce four items; the icons are decorative.
export function TrustStrip() {
  const { t } = useTranslation('marketplace');

  const items = [
    { key: 'cod', icon: Banknote, label: t('trust.cod'), sub: t('trust.codSub') },
    { key: 'tracking', icon: Truck, label: t('trust.tracking'), sub: t('trust.trackingSub') },
    { key: 'returns', icon: RotateCcw, label: t('trust.returns'), sub: t('trust.returnsSub') },
    { key: 'bilingual', icon: Languages, label: t('trust.bilingual'), sub: t('trust.bilingualSub') },
  ];

  return (
    <div className="trust">
      <ul className="trust__list">
        {items.map(({ key, icon: Icon, label, sub }) => (
          <li key={key} className={`trust__item trust__item--${key}`}>
            <span className="trust__icon">
              <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
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
