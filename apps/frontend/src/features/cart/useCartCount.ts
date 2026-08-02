import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../../lib/authStore';
import { CART_QUERY_KEY, getCart } from './cartApi';
import { useGuestCartStore } from './guestCartStore';

// Derived, not new state — sums the persisted cart for a signed-in Buyer, or the local
// guest cart otherwise. Keeps the header badge from becoming a second source of truth.
export function useCartCount(): number {
  const user = useAuthStore((s) => s.user);
  const guestItems = useGuestCartStore((s) => s.items);

  const { data: cart } = useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: getCart,
    enabled: user?.role === 'BUYER',
  });

  if (user?.role === 'BUYER') {
    if (!cart) return 0;
    return cart.sellerGroups.reduce(
      (sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + item.quantity, 0),
      0,
    );
  }

  return guestItems.reduce((sum, item) => sum + item.quantity, 0);
}
