import { z } from "zod";

export const stopIdParamSchema = z.object({
  stopId: z.string().uuid(),
});

export const routeIdParamSchema = z.object({
  routeId: z.string().uuid(),
});

export const createStopBodySchema = z.object({
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  route_id: z.string().uuid(),
  stop_name: z.string().trim().min(1),
  stop_order: z.coerce.number().int().positive().optional(),
});

export const updateStopBodySchema = z.object({
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  stop_name: z.string().trim().min(1).optional(),
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
