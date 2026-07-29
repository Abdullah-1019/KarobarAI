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
