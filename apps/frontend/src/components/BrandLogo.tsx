import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useLanguage } from '../hooks';

// KarobarAI brand lockup — an inline SVG bag+spark mark (persimmon bag, AI-accent spark: the same
// spark as the PWA icon) beside the "Karobar" wordmark with "AI" in persimmon. The wordmark is the
// only localized part: Urdu renders "کاروبار", English "Karobar". "AI" stays Latin in both (it's the product name). Colour follows
// `currentColor` for the wordmark, so it reads on white headers and the ink footer alike.
// `to` lets the Seller/Admin headers point the logo at their own home. Used by every header,
// the footer and the auth panel — the one KarobarAI lockup.
export function BrandLogo({ to = '/' }: { to?: string }) {
  const { t } = useTranslation('marketplace');
  const { language } = useLanguage();
  const wordmark = language === 'UR' ? 'کاروبار' : 'Karobar';

  return (
    <Link to={to} className="storefront-logo" aria-label={t('logo.aria')}>
      <svg className="storefront-logo__mark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <path
          d="M8.5 11.5h15l-1.1 14.1a2 2 0 0 1-2 1.9H11.6a2 2 0 0 1-2-1.9L8.5 11.5Z"
          fill="none"
          stroke="var(--brand-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M12.5 11.5V8.8a3.5 3.5 0 0 1 7 0v2.7"
          fill="none"
          stroke="var(--brand-primary)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M24.5 3.2l1.05 2.7 2.7 1.05-2.7 1.05L24.5 10.7l-1.05-2.7-2.7-1.05 2.7-1.05L24.5 3.2Z"
          fill="var(--ai-accent)"
        />
      </svg>
      <span className="storefront-logo__word">
        {wordmark}
        <span className="storefront-logo__ai">AI</span>
      </span>
    </Link>
  );
}
