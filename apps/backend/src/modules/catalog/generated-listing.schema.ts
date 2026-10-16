import { z } from 'zod';

// Validate the private AI-service response again before any product write.
export const generatedListingResponseSchema = z.object({
  title_en: z.string().trim().min(1),
  title_ur: z.string().trim().min(1),
  description_en: z.string().trim().min(1),
  description_ur: z.string().trim().min(1),
  category: z.string(),
  tags: z.array(z.string()),
}).strict();
