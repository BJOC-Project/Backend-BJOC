import { z } from "zod";

const latitudeSchema = z.coerce.number().min(-90).max(90);
const longitudeSchema = z.coerce.number().min(-180).max(180);

export const stopIdParamSchema = z.object({
  stopId: z.string().uuid(),
});

export const routeIdParamSchema = z.object({
  routeId: z.string().uuid(),
});

export const createStopBodySchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  route_id: z.string().uuid(),
  stop_name: z.string().trim().min(1),
  stop_order: z.coerce.number().int().positive().optional(),
});

export const updateStopBodySchema = z.object({
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  stop_name: z.string().trim().min(1).optional(),
}).superRefine((value, ctx) => {
  const hasLatitude = typeof value.latitude === "number";
  const hasLongitude = typeof value.longitude === "number";

  if (hasLatitude !== hasLongitude) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Latitude and longitude must be updated together.",
      path: hasLatitude ? ["longitude"] : ["latitude"],
    });
  }
});

export const toggleStopStatusBodySchema = z.object({
  is_active: z.boolean(),
});

export const reorderStopsBodySchema = z.array(z.object({
  id: z.string().uuid(),
  stop_order: z.coerce.number().int().positive(),
}));

export type CreateStopBody = z.infer<typeof createStopBodySchema>;
export type ReorderStopsBody = z.infer<typeof reorderStopsBodySchema>;
export type RouteIdParams = z.infer<typeof routeIdParamSchema>;
export type StopIdParams = z.infer<typeof stopIdParamSchema>;
export type ToggleStopStatusBody = z.infer<typeof toggleStopStatusBodySchema>;
export type UpdateStopBody = z.infer<typeof updateStopBodySchema>;
