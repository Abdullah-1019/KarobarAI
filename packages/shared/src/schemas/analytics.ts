import { z } from 'zod';

// Task 1.2 — presets resolve to concrete date boundaries server-side (analytics.dateRange.ts);
// custom requires both dates and start <= end (SCR-S08's validation rule).
export const dateRangeQuerySchema = z
  .object({
    range: z.enum(['7d', '30d', '3m', 'custom']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(), // Task 6.4 — top-products only, harmless-unused elsewhere
  })
  .strict()
  .refine((data) => (data.range ?? '7d') !== 'custom' || (Boolean(data.startDate) && Boolean(data.endDate)), {
    message: 'startDate and endDate are required when range=custom',
    path: ['startDate'],
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end;
    },
    { message: 'startDate must be a valid date on or before endDate', path: ['endDate'] },
  );

export type DateRangeQueryInput = z.infer<typeof dateRangeQuerySchema>;
