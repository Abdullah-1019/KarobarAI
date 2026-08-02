import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

// Same convention as features/catalog/catalogErrors.ts — switch on `error.code`, not HTTP status
// or message text.
export function formatOrdersError(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) {
    return t('orders:errors.GENERIC');
  }

  return t(`orders:errors.${err.code}`, { defaultValue: t('orders:errors.GENERIC') });
}
