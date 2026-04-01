import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const reportQuerySchema = z.object({
  endDate: z.string().trim().regex(datePattern).optional(),
  search: z.string().trim().optional(),
  startDate: z.string().trim().regex(datePattern).optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
