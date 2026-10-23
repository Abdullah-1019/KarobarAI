import { Button } from 'antd';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatAnalyticsError } from './analyticsErrors';

// Shared in-card states so every widget fails and loads the same way: a shape-matched shimmer
// while pending, and an inline message with a retry instead of a page-level alert.
export function AnalyticsError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation(['analytics']);
  return (
    <div className="anError" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{formatAnalyticsError(t, error)}</span>
      <Button onClick={onRetry}>{t('dashboard.retry')}</Button>
    </div>
  );
}

export function Shimmer({ height, width = '100%' }: { height: number; width?: number | string }) {
  return <span className="anShimmer" style={{ height, width }} aria-hidden="true" />;
}
