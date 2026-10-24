import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Feature 6's guest-cart edge case (SCR-B01/App Flow §"guest cart held client-side until login,
// then merged to persisted cart") — there is no backend guest-cart endpoint, so this is the one
// piece of cart state that can't live in React Query. Snapshotting title/price/image (not just
// id+qty) lets CartPage render a guest's cart with zero extra product fetches.
export interface GuestCartItem {
  productId: string;
  titleEn: string;
  price: string;
  primaryImageUrl: string | null;
  quantity: number;
  // Feature 23 — the chosen size/colour; absent for products without variants (and for items
  // saved before variants existed, which therefore keep working unchanged).
  variantId?: string | null;
  variantLabel?: string | null;
}

// A guest cart line is one product in one variant, like the server's cart_items.
const sameLine = (item: GuestCartItem, productId: string, variantId?: string | null) =>
  item.productId === productId && (item.variantId ?? null) === (variantId ?? null);

interface GuestCartState {
  items: GuestCartItem[];
  addItem: (item: Omit<GuestCartItem, 'quantity'>, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  clear: () => void;
}

export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => sameLine(i, item.productId, item.variantId));
          if (existing) {
            return {
              items: state.items.map((i) =>
                sameLine(i, item.productId, item.variantId) ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        }),
      updateQuantity: (productId, quantity, variantId) =>
        set((state) => ({
          items: state.items.map((i) => (sameLine(i, productId, variantId) ? { ...i, quantity } : i)),
        })),
      removeItem: (productId, variantId) =>
        set((state) => ({ items: state.items.filter((i) => !sameLine(i, productId, variantId)) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'karobarai:guestCart' },
  ),
);
