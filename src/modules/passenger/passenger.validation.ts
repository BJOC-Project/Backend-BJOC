import { z } from "zod";

export const passengerTripParamsSchema = z.object({
  tripId: z.string().uuid(),
});

const imageDataUrlPattern = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;

export const passengerEmailChangeRequestSchema = {
  body: z.object({
    newEmail: z.string().trim().email(),
  }),
};

export const passengerEmailChangeVerifySchema = {
  body: z.object({
    code: z.string().trim().regex(/^\d{6}$/, "Verification code must be 6 digits"),
  }),
};

export const passengerPasswordUpdateSchema = {
  body: z.object({
    currentPassword: z.string().min(8).max(72),
    newPassword: z.string().min(8).max(72),
  }).refine(
    (value) => value.currentPassword !== value.newPassword,
    {
      message: "New password must be different from current password",
      path: ["newPassword"],
    },
  ),
};

export const passengerNameUpdateSchema = {
  body: z.object({
    currentPassword: z.string().min(8).max(72),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
  }),
};

export const passengerProfilePhotoUpdateSchema = {
  body: z.object({
    profileUrl: z.union([
      z.string().trim().url().max(2000),
      z.string().trim().max(2_000_000).refine(
        (value) => imageDataUrlPattern.test(value),
        "Profile photo must be a valid image data URL",
      ),
      z.null(),
    ]),
  }),
};

export type PassengerTripParams = z.infer<typeof passengerTripParamsSchema>;
