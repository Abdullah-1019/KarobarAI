// Validation schemas live in packages/shared/src/schemas/profile.ts (TRD §4: shared Zod schemas
// with the API contract), same pattern as modules/auth/auth.dto.ts. Re-exported here so this
// module's imports read the same way every other module's do.
export {
  updateSellerProfileSchema,
  setDefaultAddressSchema,
  changePasswordSchema,
  updateSettingsSchema,
} from '@karobarai/shared';
export type {
  UpdateSellerProfileInput,
  SetDefaultAddressInput,
  ChangePasswordInput,
  UpdateSettingsInput,
} from '@karobarai/shared';
