export type AuthRole = 'BUYER' | 'SELLER';

const KEY = 'ka.authRole';

// The auth panel's story (buyer vs seller) remembers the last choice on this device; Register's
// role cards and the panel switch share it. Storage can throw (private mode), so both sides guard.
export function readAuthRole(): AuthRole {
  try {
    return window.localStorage.getItem(KEY) === 'SELLER' ? 'SELLER' : 'BUYER';
  } catch {
    return 'BUYER';
  }
}

export function writeAuthRole(role: AuthRole) {
  try {
    window.localStorage.setItem(KEY, role);
  } catch {
    /* per-device convenience only */
  }
}
