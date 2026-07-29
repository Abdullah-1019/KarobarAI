import type { Language, UserRole, UserStatus } from '@karobarai/shared';
import { create } from 'zustand';

// Matches the `user` field returned by register(email)/otp-verify/login
// (apps/backend/src/modules/auth/auth.service.ts `issueAuthResult`) — deliberately no
// phone/email (the backend never returns decrypted PII here either). GET /me additionally
// returns `createdAt`, but nothing here calls /me yet (see authStore's own note below).
export interface AuthUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  preferredLanguage: Language;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
}

// In-memory only (Zustand, TRD §4) — no persistence yet. Session-restore-on-reload (calling
// /refresh + /me on app boot) is deferred until a protected/logged-in screen actually needs it
// (Day 4, RBAC/session handling per docs/DailyPlan.md).
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
}));
