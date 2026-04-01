import { z } from "zod";

const userRoleSchema = z.enum([
  "admin",
  "driver",
  "operator",
  "passenger",
  "staff",
]);

export const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});

export const createUserBodySchema = z.object({
  contact_number: z.string().trim().optional(),
  email: z.string().trim().email(),
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  license_number: z.string().trim().min(1).optional(),
  middle_name: z.string().trim().optional(),
  password: z.string().trim().min(8),
  role: userRoleSchema,
}).superRefine((value, ctx) => {
  if (value.role === "driver" && !value.license_number?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "License number is required for drivers.",
      path: ["license_number"],
    });
  }
});

export const updateUserBodySchema = z.object({
  contact_number: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  first_name: z.string().trim().min(1).optional(),
  last_name: z.string().trim().min(1).optional(),
  license_number: z.string().trim().min(1).optional(),
  middle_name: z.string().trim().optional(),
  password: z.string().trim().min(8).optional(),
  role: userRoleSchema.optional(),
});

export const suspendUserBodySchema = z.object({
  days: z.coerce.number().int().min(1).max(365),
  reason: z.string().trim().min(1),
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type SuspendUserBody = z.infer<typeof suspendUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamSchema>;
