import { z } from 'zod';

import { passwordSchema } from './auth';

// Shared between apps/backend and apps/frontend (TRD §4), same convention as ./auth.ts.

// Feature 2 Task 3 (Profile Update) — the source playbook's Task 3 section heading/content was
// missing from the module doc itself (only referenced by later tasks as a dependency). Scope
// derived instead from App Flow SCR-S10 ("Store/Brand" tab: store_name, store_description,
// logo_url) and SCR-B12 ("Addresses" tab, default-address selection only — full address CRUD is
// a separate feature) plus Schema §4.2/§4.4. Neither screen lists an editable
// phone/email/name field, so none is invented here.

// Feature 3 (Store Management) note: logoUrl was removed from this schema — it used to accept
// an arbitrary client-supplied URL directly, which would now bypass Task 4's validated upload
// endpoint (magic-byte checks, size limits). logoUrl/bannerUrl are only ever settable via
// POST /profile/me/store/logo and /banner.
export const updateSellerProfileSchema = z
  .object({
    storeName: z.string().min(1).max(120).optional(),
    storeDescription: z.string().max(2000).nullable().optional(),
  })
  .strict();

// Feature 3 Task 2 — the SCR-S00 wizard's "Finish" payload. Wallet fields mirror Schema §4.2's
// original jazzcash_wallet/easypaisa_wallet naming (now persisted into the payout_wallets table
// per addendum §14.1, not fixed columns) — at least one is required per REQ-F-Auth005.
export const createStoreSchema = z
  .object({
    storeName: z.string().min(1).max(120),
    storeDescription: z.string().max(2000).nullable().optional(),
    jazzcashAccountNumber: z.string().min(1).optional(),
    easypaisaAccountNumber: z.string().min(1).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.jazzcashAccountNumber) || Boolean(data.easypaisaAccountNumber), {
    message: 'At least one payout wallet (JazzCash or Easypaisa account number) is required',
    path: ['jazzcashAccountNumber'],
  });

// addressId travels as a numeric string — Address has no public_id/UUID column yet (full address
// CRUD, which would add one, is out of scope for this feature), and BigInt isn't valid JSON.
export const setDefaultAddressSchema = z
  .object({
    addressId: z.string().regex(/^\d+$/, 'addressId must be numeric'),
  })
  .strict();

// REQ-F-Auth002's complexity rule, imported from ../schemas/auth.ts — never redefined here.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'Passwords do not match',
  });

export const updateSettingsSchema = z
  .object({
    smsEnabled: z.boolean().optional(),
    whatsappEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    inappEnabled: z.boolean().optional(),
    preferredLanguage: z.enum(['EN', 'UR']).optional(),
  })
  .strict();

export type UpdateSellerProfileInput = z.infer<typeof updateSellerProfileSchema>;
export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type SetDefaultAddressInput = z.infer<typeof setDefaultAddressSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
