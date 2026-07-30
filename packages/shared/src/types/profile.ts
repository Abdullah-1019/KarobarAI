import type { Language, UserRole, UserStatus } from '../enums/index';

// Response DTOs for GET /api/v1/profile/me (Feature 2 Task 2) — one canonical shape per role,
// consumed by both apps/backend (response typing) and apps/frontend (query typing).

interface BaseProfileDTO {
  id: string; // user.publicId
  role: UserRole;
  status: UserStatus;
  preferredLanguage: Language;
  avatarUrl: string | null;
  createdAt: string; // ISO 8601
}

export interface BuyerProfileDTO extends BaseProfileDTO {
  role: 'BUYER';
  defaultAddressId: string | null; // BigInt as string — see schemas/profile.ts note
}

export interface SellerProfileDTO extends BaseProfileDTO {
  role: 'SELLER';
  // Deliberately excludes commissionRate/fraudRate30d/payout wallets — Task 0's stated
  // assumption in the module doc; those are admin/payout-feature concerns, not profile data.
  storeName: string;
  storeDescription: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  // Feature 3 (Store Management): true once onboarding (POST /profile/me/store) has completed.
  // A seller_profiles row always exists from account activation (a placeholder, Feature 1's
  // activateUser) — hasStore is NOT "does a row exist", it's "has onboarding actually finished".
  hasStore: boolean;
}

// Feature 3 Task 6 — read-only, derived from users.status; no separate store-status column
// exists anywhere in the schema. `since` is approximated from users.updated_at (no dedicated
// status-change-timestamp column exists) — the precise history lives in audit_logs, out of
// scope for this seller-facing read.
export interface StoreStatusDTO {
  status: UserStatus;
  since: string; // ISO 8601
}

export interface AdminProfileDTO extends BaseProfileDTO {
  role: 'ADMIN' | 'SUPPORT';
  // Identity fields only — no App Flow screen defines an admin self-profile beyond this
  // (verified against AD01-AD08; none is a self-profile screen).
}

export type ProfileDTO = BuyerProfileDTO | SellerProfileDTO | AdminProfileDTO;

export interface AccountSettingsDTO {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  inappEnabled: boolean;
  preferredLanguage: Language;
}

// REQ-F-Notif004: critical channels can't be disabled. Per the module doc's stated assumption,
// in-app + SMS (MVP's primary channel, PRD §12.12) are treated as the non-disableable set;
// whatsapp/email remain user-toggleable. Shared so frontend renders these as visually locked
// rather than re-deriving the list.
export const CRITICAL_NOTIFICATION_CHANNELS = ['inappEnabled', 'smsEnabled'] as const;
export type CriticalNotificationChannel = (typeof CRITICAL_NOTIFICATION_CHANNELS)[number];
