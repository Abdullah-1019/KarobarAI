import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

// Same convention as features/catalog/catalogErrors.ts — switch on `error.code`, not HTTP status
// or message text.
export function formatMarketplaceError(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) {
    return t('marketplace:errors.GENERIC');
  }

  return t(`marketplace:errors.${err.code}`, { defaultValue: t('marketplace:errors.GENERIC') });
}
