import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '../components';

// Catch-all route: a translated "page not found" with one way home.
export function NotFoundPage() {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();
  return (
    <div style={{ padding: 'clamp(32px, 10vh, 96px) 16px' }}>
      <EmptyState
        icon={<Compass size={28} />}
        title={t('placeholder.notFoundTitle')}
        description={t('placeholder.notFoundBody')}
        actionLabel={t('placeholder.goHome')}
        onAction={() => navigate('/')}
        headingLevel={1}
      />
    </div>
  );
}
