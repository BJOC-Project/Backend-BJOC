import { z } from "zod";
export { systemMaintenanceSettingsBodySchema } from "../system-settings/system-settings.validation";
export type { SystemMaintenanceSettingsBody } from "../system-settings/system-settings.validation";

export const dashboardFilterQuerySchema = z.object({
  filter: z.enum([
    "today",
    "week",
    "month",
  ]).optional(),
});

export const waitingStopsQuerySchema = z.object({
  filter: z.enum([
    "today",
    "week",
    "month",
  ]).optional(),
  routeId: z.string().uuid(),
});

export type DashboardFilterQuery = z.infer<typeof dashboardFilterQuerySchema>;
export type WaitingStopsQuery = z.infer<typeof waitingStopsQuerySchema>;
