import { Sparkles, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../components';

// "Sell with AI" banner — emerald→saffron gradient echoing the hero. Copy stays honest (rule K):
// the AI Store Builder writes titles/descriptions/tags, so the banner claims exactly that and
// nothing more. The mock listing card is decorative.
export function AiBanner() {
  const { t } = useTranslation('marketplace');

  return (
    <div className="ai-banner">
      <div className="ai-banner__copy">
        <span className="ai-banner__badge">
          <Sparkles size={15} aria-hidden="true" />
          {t('home.aiBanner.badge')}
        </span>
        <h2 className="ai-banner__title">{t('home.aiBanner.title')}</h2>
        <p className="ai-banner__sub">{t('home.aiBanner.subtitle')}</p>
        <div className="ai-banner__ctas">
          <Button variant="cta" size="lg" to="/register?role=seller">
            {t('home.aiBanner.cta')}
          </Button>
          <Button variant="outline-light" size="lg" href="#how-it-works">
            {t('home.aiBanner.secondary')}
          </Button>
        </div>
      </div>

      <div className="ai-banner__art" aria-hidden="true">
        <div className="ai-card">
          <span className="ai-card__img">
            <Sparkles size={34} />
          </span>
          <span className="ai-card__lines">
            <span className="ai-card__line" />
            <span className="ai-card__line ai-card__line--short" />
          </span>
        </div>
        <span className="ai-banner__chip">
          <Wand2 size={15} />
          {t('home.aiBanner.artChip')}
        </span>
      </div>
    </div>
  );
}
