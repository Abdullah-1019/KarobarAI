import type { UserRole } from '@karobarai/shared';

// Buyer→storefront, Seller→dashboard, Admin→admin (App Flow §6.1). Seller's onboarding-step
// redirect into the Store-Setup Wizard lands with Feature 3 — for now every Seller lands on the
// same F0 placeholder as a direct login would.
export function roleHomePath(role: UserRole): string {
  switch (role) {
    case 'SELLER':
      return '/seller';
    case 'ADMIN':
      return '/admin';
    default:
      return '/buyer';
  }
}
