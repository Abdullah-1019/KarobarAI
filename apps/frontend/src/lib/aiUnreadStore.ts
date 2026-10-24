import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// "The AI answered while you were looking elsewhere" — drives the badge on AI entry points.
// seller: Seller Assistant replies that finished after the seller left /seller/assistant (kept for
//   the browser session, like the assistant's own session id).
// buyer: store-chat replies that arrived while that store's chat sheet was closed, keyed by store
//   slug. That conversation only lives while its page is open, so these are not persisted.
interface AiUnreadState {
  seller: number;
  sellerViewing: boolean;
  /** Bumped when a reply lands for a newer Seller Assistant screen than the one that asked. */
  sellerReloadTick: number;
  buyer: Record<string, number>;
  setSellerViewing: (viewing: boolean) => void;
  sellerReplyLanded: () => void;
  clearSeller: () => void;
  buyerReplyLanded: (storeSlug: string) => void;
  clearBuyer: (storeSlug: string) => void;
}

export const useAiUnreadStore = create<AiUnreadState>()(
  persist(
    (set, get) => ({
      seller: 0,
      sellerViewing: false,
      sellerReloadTick: 0,
      buyer: {},
      setSellerViewing: (viewing) => set(viewing ? { sellerViewing: true, seller: 0 } : { sellerViewing: false }),
      sellerReplyLanded: () =>
        set(get().sellerViewing ? { sellerReloadTick: get().sellerReloadTick + 1 } : { seller: get().seller + 1 }),
      clearSeller: () => set({ seller: 0 }),
      buyerReplyLanded: (storeSlug) => set({ buyer: { ...get().buyer, [storeSlug]: (get().buyer[storeSlug] ?? 0) + 1 } }),
      clearBuyer: (storeSlug) => {
        if (!get().buyer[storeSlug]) return;
        const next = { ...get().buyer };
        delete next[storeSlug];
        set({ buyer: next });
      },
    }),
    {
      name: 'karobarai:ai-unread',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ seller: state.seller }),
    },
  ),
);
