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

const tripStartBodyBaseSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
}).superRefine((value, ctx) => {
  const hasLatitude = typeof value.latitude === "number";
  const hasLongitude = typeof value.longitude === "number";

  if (hasLatitude !== hasLongitude) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Latitude and longitude are both required when sending start location.",
      path: hasLatitude ? ["longitude"] : ["latitude"],
    });
  }
});

export const tripStartBodySchema = tripStartBodyBaseSchema
  .optional()
  .transform((value) => value ?? {});

export const tripEndBodySchema = z.object({
  client_action_id: z.string().trim().min(1).optional(),
  passenger_count: z.number().int().min(0),
});

export type RescheduleTripBody = z.infer<typeof rescheduleTripBodySchema>;
export type ScheduleTripBody = z.infer<typeof scheduleTripBodySchema>;
export type TripEndBody = z.infer<typeof tripEndBodySchema>;
export type TripIdParams = z.infer<typeof tripIdParamSchema>;
export type TripStartBody = z.infer<typeof tripStartBodyBaseSchema>;
