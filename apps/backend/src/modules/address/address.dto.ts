// Validation schemas live in packages/shared/src/schemas/cart.ts (TRD §4: shared Zod schemas
// with the API contract) — grouped there alongside checkout since Address Management is this
// feature's Task 5, not a separate shared-schema file.
export { createAddressSchema, updateAddressSchema } from '@karobarai/shared';
export type { CreateAddressInput, UpdateAddressInput } from '@karobarai/shared';
