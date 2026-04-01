import { z } from "zod";

export const vehicleIdParamSchema = z.object({
  vehicleId: z.string().uuid(),
});

export const createVehicleBodySchema = z.object({
  capacity: z.coerce.number().int().positive(),
  driver_id: z.string().uuid().nullable().optional(),
  model: z.string().trim().optional(),
  plate_number: z.string().trim().min(1),
  status: z.enum([
    "offline",
    "available",
    "on_route",
    "maintenance",
  ]).optional(),
});

export const updateVehicleBodySchema = z.object({
  capacity: z.coerce.number().int().positive().optional(),
  driver_id: z.string().uuid().nullable().optional(),
  model: z.string().trim().optional(),
  plate_number: z.string().trim().min(1).optional(),
  status: z.enum([
    "offline",
    "available",
    "on_route",
    "maintenance",
  ]).optional(),
});

export type CreateVehicleBody = z.infer<typeof createVehicleBodySchema>;
export type UpdateVehicleBody = z.infer<typeof updateVehicleBodySchema>;
export type VehicleIdParams = z.infer<typeof vehicleIdParamSchema>;
