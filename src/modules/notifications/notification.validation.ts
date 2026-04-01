import { z } from "zod";

export const notificationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  role: z.string().trim().optional(),
  severity: z.enum([
    "info",
    "success",
    "warning",
    "critical",
  ]).optional(),
  type: z.enum([
    "trip",
    "vehicle",
    "driver",
    "maintenance",
    "route",
    "system",
    "emergency",
    "message",
  ]).optional(),
});

export const readAllNotificationsBodySchema = z.object({
  role: z.string().trim().optional(),
});

export type NotificationIdParams = z.infer<typeof notificationIdParamSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
