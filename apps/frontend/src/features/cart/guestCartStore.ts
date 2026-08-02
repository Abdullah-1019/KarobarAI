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
}

interface GuestCartState {
  items: GuestCartItem[];
  addItem: (item: Omit<GuestCartItem, 'quantity'>, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId ? { ...i, quantity: i.quantity + quantity } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        }),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'karobarai:guestCart' },
  ),
);
