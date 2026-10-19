import { z } from 'zod';

export const storeDirectoryQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  categorySlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  sort: z.enum(['name', 'newest', 'most_products']).default('name'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(12),
}).strict();
