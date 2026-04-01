import { z } from "zod";

export const tripIdParamSchema = z.object({
  tripId: z.string().uuid(),
});

export const scheduleTripBodySchema = z.object({
  route_id: z.string().uuid(),
  scheduled_departure_time: z.string().trim().min(1),
  trip_date: z.string().trim().min(1),
  vehicle_id: z.string().uuid(),
});

export const rescheduleTripBodySchema = z.object({
  scheduled_departure_time: z.string().trim().min(1),
});

export const tripEndBodySchema = z.object({
  client_action_id: z.string().trim().min(1).optional(),
  passenger_count: z.number().int().min(0),
});

export type RescheduleTripBody = z.infer<typeof rescheduleTripBodySchema>;
export type ScheduleTripBody = z.infer<typeof scheduleTripBodySchema>;
export type TripEndBody = z.infer<typeof tripEndBodySchema>;
export type TripIdParams = z.infer<typeof tripIdParamSchema>;
