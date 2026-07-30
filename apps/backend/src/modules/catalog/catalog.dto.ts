// Validation schemas live in packages/shared/src/schemas/catalog.ts (TRD §4: shared Zod schemas
// with the API contract), same pattern as every other module's dto.ts.
export {
  AUTOCOMPLETE_MIN_CHARS,
  autocompleteQuerySchema,
  createProductSchema,
  listSellerProductsQuerySchema,
  reorderImagesSchema,
  searchQuerySchema,
  updateProductSchema,
} from '@karobarai/shared';
export type {
  AutocompleteQueryInput,
  CreateProductInput,
  ListSellerProductsQueryInput,
  ReorderImagesInput,
  SearchQueryInput,
  UpdateProductInput,
} from '@karobarai/shared';
