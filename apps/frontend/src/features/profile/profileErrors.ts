import type { TFunction } from 'i18next';

import { ApiError } from '../../api';

// Same convention as features/auth/authErrors.ts: switch on `error.code`, not HTTP status or
// message text, per HO-F1-Auth.md / F2-profiles-backend.md. Falls back to a generic message for
// any code this screen doesn't have specific copy for yet (e.g. a stray auth-namespace code).
export function formatProfileError(t: TFunction, err: unknown): string {
  if (!(err instanceof ApiError)) {
    return t('profile:errors.GENERIC');
  }

  return t(`profile:errors.${err.code}`, { defaultValue: t('profile:errors.GENERIC') });
}
