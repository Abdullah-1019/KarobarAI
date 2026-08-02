import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

// Same convention as features/catalog/catalogErrors.ts — switch on `error.code`, not HTTP status
// or message text.
export function formatCartError(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) {
    return t('cart:errors.GENERIC');
  }

  return t(`cart:errors.${err.code}`, { defaultValue: t('cart:errors.GENERIC') });
}
