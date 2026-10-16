import { PackageCheck, Store, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Section } from '../../components';

// "How KarobarAI works" — three honest steps (no fabricated stats/testimonials, rule K). Rendered
// as a real ordered list so the sequence is announced; the big index number and icons are
// decorative only.
export function HowItWorks() {
  const { t } = useTranslation('marketplace');

  const steps = [
    { key: 'store', icon: Store, title: t('home.howItWorks.step1Title'), body: t('home.howItWorks.step1Body') },
    { key: 'ai', icon: Wand2, title: t('home.howItWorks.step2Title'), body: t('home.howItWorks.step2Body') },
    { key: 'sell', icon: PackageCheck, title: t('home.howItWorks.step3Title'), body: t('home.howItWorks.step3Body') },
  ];

  return (
    <Section id="how-it-works" tone="white" title={t('home.howItWorks.title')} subtitle={t('home.howItWorks.subtitle')}>
      <ol className="how">
        {steps.map(({ key, icon: Icon, title, body }, index) => (
          <li key={key} className="how__step">
            <span className="how__index" aria-hidden="true">
              {index + 1}
            </span>
            <span className="how__icon">
              <Icon size={26} aria-hidden="true" />
            </span>
            <h3 className="how__title">{title}</h3>
            <p className="how__body">{body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
