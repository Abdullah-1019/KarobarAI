import { z } from 'zod';

import { passwordSchema } from './auth';

const categoryIdSchema = z.string().regex(/^[1-9]\d{0,18}$/, 'Select a valid category')
  .refine((value) => BigInt(value) <= 9223372036854775807n, 'Select a valid category');

function httpsLinkSchema(domains?: readonly string[]) {
  return z.string().trim().max(255).refine((value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
      const host = url.hostname.toLowerCase();
      if (domains) return domains.includes(host);
      return host.includes('.') && host !== 'localhost' && !/^\d+(?:\.\d+){3}$/.test(host);
    } catch {
      return false;
    }
  }, 'Enter a valid HTTPS link for this platform').transform((value) => new URL(value).toString());
}

const optionalLink = (domains?: readonly string[]) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  httpsLinkSchema(domains).nullable().optional(),
);

const whatsappNumber = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  z.string().trim().max(255)
    .transform((value) => value.replace(/[\s()\-]/g, ''))
    .refine((value) => /^\+[1-9]\d{7,14}$/.test(value), 'Enter an international number beginning with +')
    .nullable().optional(),
);

export const storeSocialLinksSchema = z.object({
  facebook: optionalLink(['facebook.com', 'www.facebook.com', 'm.facebook.com']),
  instagram: optionalLink(['instagram.com', 'www.instagram.com']),
  tiktok: optionalLink(['tiktok.com', 'www.tiktok.com']),
  youtube: optionalLink(['youtube.com', 'www.youtube.com', 'youtu.be']),
  whatsapp: whatsappNumber,
  website: optionalLink(),
}).strict();

export type StoreSocialLinks = {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
  website?: string;
};

const storeDetailsFields = {
  storeCategoryId: categoryIdSchema.nullable().optional(),
  city: z.string().trim().max(80).transform((value) => value || null).nullable().optional(),
  socialLinks: storeSocialLinksSchema.optional(),
};

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
    storeDescriptionUr: z.string().max(2000).nullable().optional(),
    ...storeDetailsFields,
  })
  .strict();

// Feature 3 Task 2 — the SCR-S00 wizard's "Finish" payload. Wallet fields mirror Schema §4.2's
// original jazzcash_wallet/easypaisa_wallet naming (now persisted into the payout_wallets table
// per addendum §14.1, not fixed columns) — at least one is required per REQ-F-Auth005.
export const createStoreSchema = z
  .object({
    storeName: z.string().min(1).max(120),
    storeDescription: z.string().max(2000).nullable().optional(),
    storeDescriptionUr: z.string().max(2000).nullable().optional(),
    ...storeDetailsFields,
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
