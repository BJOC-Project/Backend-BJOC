import { z } from "zod";

export const assignDriverBodySchema = z.object({
  driver_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
});

export type AssignDriverBody = z.infer<typeof assignDriverBodySchema>;
