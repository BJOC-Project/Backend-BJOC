import { z } from "zod";

export const planRouteQuerySchema = z.object({
  originLat: z.coerce.number().min(-90).max(90),
  originLng: z.coerce.number().min(-180).max(180),
  destLat: z.coerce.number().min(-90).max(90),
  destLng: z.coerce.number().min(-180).max(180),
});

export const routeSegmentQuerySchema = z.object({
  routeId: z.string().uuid(),
  pickupStopId: z.string().uuid(),
  dropoffStopId: z.string().uuid(),
});

export const bookRouteBodySchema = z.object({
  routeId: z.string().uuid(),
  pickupStopId: z.string().uuid(),
  dropoffStopId: z.string().uuid(),
});

export const routeIdParamSchema = z.object({
  routeId: z.string().uuid(),
});

export const createRouteBodySchema = z.object({
  end_location: z.string().trim().min(1),
  route_name: z.string().trim().optional(),
  start_location: z.string().trim().min(1),
});

export const updateRouteBodySchema = z.object({
  end_location: z.string().trim().min(1).optional(),
  route_name: z.string().trim().optional(),
  start_location: z.string().trim().min(1).optional(),
});

export const routeStatusBodySchema = z.object({
  is_active: z.boolean(),
});

export const stopEtaQuerySchema = z.object({
  stopId: z.string().uuid(),
});

export type PlanRouteQuery = z.infer<typeof planRouteQuerySchema>;
export type RouteSegmentQuery = z.infer<typeof routeSegmentQuerySchema>;
export type BookRouteBody = z.infer<typeof bookRouteBodySchema>;
export type CreateRouteBody = z.infer<typeof createRouteBodySchema>;
export type RouteIdParams = z.infer<typeof routeIdParamSchema>;
export type UpdateRouteBody = z.infer<typeof updateRouteBodySchema>;
export type RouteStatusBody = z.infer<typeof routeStatusBodySchema>;
export type StopEtaQuery = z.infer<typeof stopEtaQuerySchema>;
