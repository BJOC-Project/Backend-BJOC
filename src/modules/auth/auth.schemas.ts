import { z } from "zod";

export const registerSchema = {
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
    firstName: z.string().trim().min(1).max(100),
    middleName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().min(1).max(100),
    contact: z.string().trim().max(30).optional(),
    username: z.string().trim().min(3).max(50).optional(),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
  }),
};
