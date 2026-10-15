import { Banknote, Smartphone, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Section } from '../../components';

// Payment options strip — exactly the methods the checkout actually accepts (PaymentMethod enum:
// JAZZCASH | EASYPUPAISA | COD). Deliberately plain icon + label chips, not third-party brand
// logos: KarobarAI has no signed partnership to display (rule K). A short note keeps it framed as
// "available at checkout", not an endorsement. Bank transfer / card are NOT listed — the backend
// offers no such method, so advertising them would be a fabricated option.
export function PaymentStrip() {
  const { t } = useTranslation('marketplace');

  const items = [
    { key: 'jazzcash', icon: Wallet, label: t('home.payments.jazzcash') },
    { key: 'easypaisa', icon: Smartphone, label: t('home.payments.easypaisa') },
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
