import { z } from 'zod';

export const bookCourierSchema = z
  .object({
    courierCode: z.enum(['TCS', 'LEOPARDS', 'TRAX']),
  })
  .strict();

export type BookCourierInput = z.infer<typeof bookCourierSchema>;
