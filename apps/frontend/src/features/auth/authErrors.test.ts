import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api';
import { formatAuthError } from './authErrors';

// Minimal stand-in for i18next's t(): echoes whatever key it's handed so the assertions can
// verify which error key (and interpolation args) formatAuthError actually requests.
function makeT() {
  return vi.fn((key: string) => key);
}

describe('formatAuthError', () => {
  it('falls back to the generic message for a non-API error', () => {
    const t = makeT();
    const result = formatAuthError(t as unknown as TFunction, new Error('boom'));

    expect(result).toBe('auth:errors.GENERIC');
    expect(t).toHaveBeenCalledWith('auth:errors.GENERIC');
  });

  it('maps a known API error code to its own copy', () => {
    const t = makeT();
    const result = formatAuthError(
      t as unknown as TFunction,
      new ApiError('INVALID_CREDENTIALS', 'nope')
    );

    expect(result).toBe('auth:errors.INVALID_CREDENTIALS');
    expect(t).toHaveBeenCalledWith('auth:errors.INVALID_CREDENTIALS', {
      defaultValue: 'auth:errors.GENERIC',
      minutes: undefined,
    });
  });

  it('converts retryAfterSeconds into whole minutes for lockout codes', () => {
    const t = makeT();
    const result = formatAuthError(
      t as unknown as TFunction,
      new ApiError('ACCOUNT_LOCKED', 'locked', { retryAfterSeconds: 125 })
    );

    expect(result).toBe('auth:errors.ACCOUNT_LOCKED');
    expect(t).toHaveBeenCalledWith('auth:errors.ACCOUNT_LOCKED', {
      defaultValue: 'auth:errors.GENERIC',
      minutes: 3,
    });
  });
});
