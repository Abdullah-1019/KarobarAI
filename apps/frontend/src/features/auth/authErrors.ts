import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

// Switches on `error.code`, not HTTP status or message text, per HO-F1-Auth.md. Falls back to a
// generic message for any code this screen doesn't have specific copy for yet.
export function formatAuthError(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) {
    return t('auth:errors.GENERIC');
  }

  const retryAfterSeconds = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
  const minutes = retryAfterSeconds ? Math.ceil(retryAfterSeconds / 60) : undefined;

  return t(`auth:errors.${err.code}`, {
    defaultValue: t('auth:errors.GENERIC'),
    minutes,
  });
}
