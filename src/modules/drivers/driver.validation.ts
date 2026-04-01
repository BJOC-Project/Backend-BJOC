import { z } from "zod";

export const driverIdParamSchema = z.object({
  driverId: z.string().uuid(),
});

export const driverTripIdParamSchema = z.object({
  tripId: z.string().uuid(),
});

export const driverCreateBodySchema = z.object({
  contact_number: z.string().trim().optional(),
  email: z.string().trim().email(),
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  license_number: z.string().trim().min(1),
  middle_name: z.string().trim().optional(),
  password: z.string().trim().min(8),
  status: z.enum([
    "offline",
    "available",
    "driving",
    "suspended",
  ]).optional(),
});

export const driverUpdateBodySchema = z.object({
  contact_number: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  first_name: z.string().trim().min(1).optional(),
  last_name: z.string().trim().min(1).optional(),
  license_number: z.string().trim().min(1).optional(),
  middle_name: z.string().trim().optional(),
  password: z.string().trim().min(8).optional(),
  status: z.enum([
    "offline",
    "available",
    "driving",
    "suspended",
  ]).optional(),
});

export const driverEmergencyBodySchema = z.object({
  client_action_id: z.string().trim().min(1),
  passenger_count: z.number().int().min(0),
  reason_text: z.string().trim().optional(),
  reason_type: z.enum([
    "vehicle_problem",
    "other",
  ]),
}).superRefine((value, ctx) => {
  if (value.reason_type === "other" && !value.reason_text?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reason text is required for other emergency problems.",
      path: ["reason_text"],
    });
  }
});

export const driverLocationBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const driverScheduleTripBodySchema = z.object({
  route_id: z.string().uuid(),
  scheduled_departure_time: z.string().trim().min(1),
});

export type DriverCreateBody = z.infer<typeof driverCreateBodySchema>;
export type DriverEmergencyBody = z.infer<typeof driverEmergencyBodySchema>;
export type DriverIdParams = z.infer<typeof driverIdParamSchema>;
export type DriverLocationBody = z.infer<typeof driverLocationBodySchema>;
export type DriverScheduleTripBody = z.infer<typeof driverScheduleTripBodySchema>;
export type DriverTripIdParams = z.infer<typeof driverTripIdParamSchema>;
export type DriverUpdateBody = z.infer<typeof driverUpdateBodySchema>;
