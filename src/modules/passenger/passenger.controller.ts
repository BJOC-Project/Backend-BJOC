import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import {
  passengerRequestEmailChange,
  passengerUpdateName,
  passengerUpdatePassword,
  passengerUpdateProfilePhoto,
  passengerVerifyEmailChange,
} from "./passenger.account.service";
import {
  passengerListFavoriteTrips,
  passengerListRecentTrips,
  passengerListTrips,
  passengerViewProfile,
  passengerViewTripById,
} from "./passenger.service";

export const passengerGetProfile = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await passengerViewProfile(req.authUser!.userId);
  sendSuccess(res, result, "Passenger profile loaded");
});

export const passengerRequestEmailChangeCode = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await passengerRequestEmailChange(
    req.authUser!.userId,
    req.body,
  );

  sendSuccess(res, result, "Verification code sent");
});

export const passengerVerifyEmailChangeCode = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await passengerVerifyEmailChange(
    req.authUser!.userId,
    req.body,
  );

  sendSuccess(res, result, "Email updated successfully");
});

export const passengerPatchPassword = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await passengerUpdatePassword(
    req.authUser!.userId,
    req.body,
  );

  sendSuccess(res, result, "Password updated successfully");
});

export const passengerPatchName = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await passengerUpdateName(
    req.authUser!.userId,
    req.body,
  );

  sendSuccess(res, result, "Name updated successfully");
});

export const passengerPatchProfilePhoto = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await passengerUpdateProfilePhoto(
    req.authUser!.userId,
    req.body,
  );

  sendSuccess(res, result, "Profile photo updated successfully");
});

export const passengerGetRecentTrips = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await passengerListRecentTrips(req.authUser!.userId);
  sendSuccess(res, { recentTrips: result }, "Recent trips loaded");
});

export const passengerGetFavoriteTrips = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await passengerListFavoriteTrips(req.authUser!.userId);
  sendSuccess(res, { favoriteTrips: result }, "Favorite trips loaded");
});

export const passengerGetTrips = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await passengerListTrips(req.authUser!.userId);
  sendSuccess(res, { trips: result }, "All trips loaded");
});

export const passengerGetTripById = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const { tripId } = req.params as { tripId: string };
  const result = await passengerViewTripById(
    req.authUser!.userId,
    tripId,
  );

  sendSuccess(res, result, "Passenger trip loaded");
});
