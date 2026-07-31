import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

// Same convention as features/profile/profileErrors.ts — switch on `error.code`, not HTTP status
// or message text.
export function formatCatalogError(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) {
    return t('catalog:errors.GENERIC');
  }

  return t(`catalog:errors.${err.code}`, { defaultValue: t('catalog:errors.GENERIC') });
}
