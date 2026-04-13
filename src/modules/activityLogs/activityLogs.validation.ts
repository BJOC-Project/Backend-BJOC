import { z } from "zod";

export const activityLogsQuerySchema = z.object({
  action: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  module: z.string().trim().optional(),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().optional(),
});

export type ActivityLogsQuery = z.infer<typeof activityLogsQuerySchema>;
