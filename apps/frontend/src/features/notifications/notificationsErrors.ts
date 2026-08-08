import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

// Same convention as features/orders/ordersErrors.ts — switch on `error.code`, not HTTP status
// or message text.
export function formatNotificationsError(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) {
    return t('notifications:errors.GENERIC');
  }

  return t(`notifications:errors.${err.code}`, { defaultValue: t('notifications:errors.GENERIC') });
}
