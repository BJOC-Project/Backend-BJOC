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
  passengerCancelBooking,
  passengerListFavoriteTrips,
  passengerListRecentTrips,
  passengerListTrips,
  passengerSaveDeviceInfo,
  passengerToggleFavorite,
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

export const passengerCancelTripBooking = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const { tripId } = req.params as { tripId: string };
  await passengerCancelBooking(req.authUser!.userId, tripId);
  sendSuccess(res, null, "Booking cancelled");
});

export const passengerToggleTripFavorite = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const { tripId } = req.params as { tripId: string };
  const { is_favorite } = req.body as { is_favorite: boolean };
  await passengerToggleFavorite(req.authUser!.userId, tripId, is_favorite);
  sendSuccess(res, null, is_favorite ? "Trip added to favorites" : "Trip removed from favorites");
});

export const passengerSaveDevice = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as { expo_push_token?: string | null; preferred_stop_id?: string | null };
  await passengerSaveDeviceInfo(req.authUser!.userId, {
    expoPushToken: body.expo_push_token,
    preferredStopId: body.preferred_stop_id,
  });
  sendSuccess(res, null, "Device info saved");
});
