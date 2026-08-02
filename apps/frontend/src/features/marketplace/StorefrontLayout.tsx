import { Outlet } from 'react-router-dom';

import { useGuestCartMerge } from '../cart/useGuestCartMerge';
import { StorefrontHeader } from './StorefrontHeader';

// Route-layout element wrapping every storefront-facing route (home, search, product detail,
// cart, and the buyer-protected checkout/orders group) — see app/router.tsx.
export function StorefrontLayout() {
  useGuestCartMerge();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StorefrontHeader />
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
}
