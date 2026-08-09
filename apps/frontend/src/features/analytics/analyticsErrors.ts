import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

// Same convention as features/returns/returnsErrors.ts — switch on `error.code`, not HTTP status
// or message text.
export function formatAnalyticsError(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) {
    return t('analytics:errors.GENERIC');
  }

  return t(`analytics:errors.${err.code}`, { defaultValue: t('analytics:errors.GENERIC') });
}
