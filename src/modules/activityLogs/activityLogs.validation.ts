import { z } from "zod";

export const activityLogsQuerySchema = z.object({
  action: z.string().trim().optional(),
  module: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export type ActivityLogsQuery = z.infer<typeof activityLogsQuerySchema>;
