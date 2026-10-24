import { create } from 'zustand';

// Lets the storefront navbar open the AI chat of the store page the buyer is on. A mounted
// StoreChatWidget registers its store; the navbar button bumps openTick and the widget opens.
// Nothing is persisted: a store chat exists only while its page is open.
interface StoreChatState {
  active: { slug: string; name: string } | null;
  openTick: number;
  register: (store: { slug: string; name: string }) => void;
  unregister: (slug: string) => void;
  requestOpen: () => void;
}

export const useStoreChatStore = create<StoreChatState>()((set) => ({
  active: null,
  openTick: 0,
  register: (store) => set({ active: store }),
  unregister: (slug) => set((state) => (state.active?.slug === slug ? { active: null } : state)),
  requestOpen: () => set((state) => ({ openTick: state.openTick + 1 })),
}));
