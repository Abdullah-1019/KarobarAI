import { z } from 'zod';

// Shared between apps/backend and apps/frontend (TRD §4), same convention as ./auth.ts,
// ./profile.ts, ./catalog.ts.

export const addCartItemSchema = z
  .object({
    productId: z.string().min(1), // product's publicId (UUID)
    quantity: z.number().int().positive(),
  })
  .strict();

export const updateCartItemSchema = z
  .object({
    quantity: z.number().int().positive(),
  })
  .strict();

export const createAddressSchema = z
  .object({
    label: z.string().max(40).nullable().optional(),
    // Schema addition (Feature 6) — orders.ship_name needs this at checkout; no name field
    // existed anywhere upstream, so it lives on the address itself (see types/cart.ts).
    recipientName: z.string().min(1).max(120),
    line1: z.string().min(1),
    line2: z.string().nullable().optional(),
    city: z.string().min(1).max(80),
    province: z.string().min(1).max(80),
    postalCode: z.string().max(20).nullable().optional(),
    // addresses.contact_phone is nullable in the DB (Schema §4.4), but orders.ship_phone is NOT
    // NULL (§4.10/§14.4) — every address usable at checkout must have a phone the courier can
    // call, so this feature's validation requires it even though the column itself allows null.
    contactPhone: z.string().min(1),
  })
  .strict();

export const updateAddressSchema = createAddressSchema.partial();

export const checkoutSchema = z
  .object({
    addressId: z.string().regex(/^\d+$/, 'addressId must be numeric'),
    paymentMethod: z.enum(['JAZZCASH', 'EASYPAISA', 'COD']),
  })
  .strict();

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
