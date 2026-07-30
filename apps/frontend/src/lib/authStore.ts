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
  // 'restoring' while AppProviders' boot-time refresh()+me() call is in flight — ProtectedRoute
  // holds off redirecting to /login until this resolves, so a hard refresh on a protected route
  // doesn't bounce a still-logged-in user.
  status: 'restoring' | 'ready';
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
}

// In-memory only (Zustand, TRD §4) — no persistence yet; session survives a reload via the
// refresh-token cookie instead (AppProviders calls refresh()+me() on boot).
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'restoring',
  setSession: (accessToken, user) => set({ accessToken, user, status: 'ready' }),
  clearSession: () => set({ accessToken: null, user: null, status: 'ready' }),
}));
