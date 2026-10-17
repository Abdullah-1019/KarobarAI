import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// The product card's heart (DESIGN-CONSULT §7 "Save"). Wishlist (F17) has no backend yet, so a
// save is kept on this device only (localStorage) and the toast says so — a real, working control
// rather than a heart that forgets on reload. When the Wishlist API lands, this store is the one
// place to swap for server state.
interface SavedState {
  ids: string[];
  toggle: (productId: string) => boolean;
  isSaved: (productId: string) => boolean;
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (productId) => {
        const saved = get().ids.includes(productId);
        set((state) => ({
          ids: saved ? state.ids.filter((id) => id !== productId) : [...state.ids, productId],
        }));
        return !saved;
      },
      isSaved: (productId) => get().ids.includes(productId),
    }),
    { name: 'karobarai:saved' },
  ),
);
