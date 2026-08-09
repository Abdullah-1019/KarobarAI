import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

// Same convention as features/orders/ordersErrors.ts — switch on `error.code`, not HTTP status
// or message text.
export function formatReturnsError(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) {
    return t('returns:errors.GENERIC');
  }

  return t(`returns:errors.${err.code}`, { defaultValue: t('returns:errors.GENERIC') });
}
