import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import {
  tripCancelTrip,
  tripEndTrip,
  tripListActiveTrips,
  tripListHistory,
  tripRescheduleTrip,
  tripScheduleTrip,
  tripStartTrip,
} from "./trips.service";
import type {
  RescheduleTripBody,
  ScheduleTripBody,
  TripEndBody,
  TripIdParams,
} from "./trips.validation";

export const tripGetActive = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await tripListActiveTrips();
  sendSuccess(res, result, "Active trips loaded");
});

export const tripGetHistory = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await tripListHistory();
  sendSuccess(res, result, "Trip history loaded");
});

export const tripSchedule = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as ScheduleTripBody;
  const result = await tripScheduleTrip(body, req.authUser!.userId);
  sendSuccess(res, result, "Trip scheduled", 201);
});

export const tripStart = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as TripIdParams;
  const result = await tripStartTrip(params.tripId, req.authUser?.userId);
  sendSuccess(res, result, "Trip started");
});

export const tripEnd = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as TripEndBody;
  const params = req.params as unknown as TripIdParams;
  const result = await tripEndTrip(params.tripId, body, req.authUser?.userId);
  sendSuccess(res, result, "Trip ended");
});

export const tripCancel = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as TripIdParams;
  const result = await tripCancelTrip(params.tripId, req.authUser?.userId);
  sendSuccess(res, result, "Trip cancelled");
});

export const tripReschedule = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as RescheduleTripBody;
  const params = req.params as unknown as TripIdParams;
  const result = await tripRescheduleTrip(params.tripId, body, req.authUser?.userId);
  sendSuccess(res, result, "Trip rescheduled");
});
