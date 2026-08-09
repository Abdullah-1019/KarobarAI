import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

// Same convention as features/returns/returnsErrors.ts — switch on `error.code`, not HTTP status
// or message text.
export function formatAdminError(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) {
    return t('admin:errors.GENERIC');
  }

  return t(`admin:errors.${err.code}`, { defaultValue: t('admin:errors.GENERIC') });
}
