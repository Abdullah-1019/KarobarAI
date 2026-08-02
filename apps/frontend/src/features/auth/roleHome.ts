import type { UserRole } from '@karobarai/shared';

// Buyer→storefront, Seller→dashboard, Admin→admin (App Flow §6.1). Seller's onboarding-step
// redirect into the Store-Setup Wizard is handled downstream by RequireStore (Feature 3), not
// here — this just returns the role's home path; hasStore gating happens at the route layer.
// Buyer home moved from the old /buyer placeholder to '/' once Feature 5 gave it a real screen
// (SCR-B01's home route is '/', not '/buyer').
export function roleHomePath(role: UserRole): string {
  switch (role) {
    case 'SELLER':
      return '/seller';
    case 'ADMIN':
      return '/admin';
    default:
      return '/';
  }
}
