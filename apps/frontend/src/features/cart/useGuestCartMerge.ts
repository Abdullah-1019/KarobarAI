import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../lib/authStore';
import { CART_QUERY_KEY, addCartItem } from './cartApi';
import { useGuestCartStore } from './guestCartStore';

// SCR-B01's guest-cart edge case: a guest's cart is held client-side until login, then merged
// into the persisted cart via repeated POST /cart/items calls (F6-cart-checkout-backend.md —
// "entirely a frontend concern," no backend merge endpoint exists or is needed).
//
// Guarded with a ref, not just a `user` dependency check, for the same reason AppProviders.tsx's
// boot-time refresh()+me() effect is: React 18 StrictMode double-invokes effects in dev, and
// without it a stale double-fire could double-add guest items before the first merge clears them.
export function useGuestCartMerge() {
  const user = useAuthStore((s) => s.user);
  const merged = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (merged.current || !user || user.role !== 'BUYER') return;
    const items = useGuestCartStore.getState().items;
    if (items.length === 0) return;

    merged.current = true;
    (async () => {
      // allSettled — one already-out-of-stock guest item shouldn't block merging the rest;
      // the buyer's persisted cart becomes the source of truth going forward either way.
      await Promise.allSettled(items.map((i) => addCartItem({ productId: i.productId, quantity: i.quantity })));
      useGuestCartStore.getState().clear();
      await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    })();
  }, [user, queryClient]);
}
