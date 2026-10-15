import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getWhatsAppUrl } from './whatsapp';

// Floating "chat on WhatsApp" action. Renders nothing when no number is configured (see
// whatsapp.ts) rather than linking to a placeholder number. Text label on wide screens, icon-only
// pill on mobile so it never collides with the fixed bottom tab bar.
export function WhatsAppButton() {
  const { t } = useTranslation('marketplace');
  const href = getWhatsAppUrl(t('whatsapp.prefill'));

  if (!href) {
    return null;
  }

  return (
    <a
      className="whatsapp-fab"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('whatsapp.label')}
    >
      <MessageCircle size={22} aria-hidden="true" />
      <span className="whatsapp-fab__label">{t('whatsapp.label')}</span>
    </a>
  );
}
