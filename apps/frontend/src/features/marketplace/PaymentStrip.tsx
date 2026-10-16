import { Banknote } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Section } from '../../components';

// COD is always available. Stripe test-mode availability depends on backend configuration;
// checkout displays the current enabled methods. The local gateways remain disabled.
export function PaymentStrip() {
  const { t } = useTranslation('marketplace');

  const items = [
    { key: 'cod', icon: Banknote, label: t('home.payments.cod') },
  ];

  return (
    <Section className="payments">
      <div className="payments__inner">
        <h2 className="payments__title">{t('home.payments.title')}</h2>
        <ul className="payments__list">
          {items.map(({ key, icon: Icon, label }) => (
            <li key={key} className="payments__item">
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <p className="payments__note">{t('home.payments.note')}</p>
      </div>
    </Section>
  );
}
