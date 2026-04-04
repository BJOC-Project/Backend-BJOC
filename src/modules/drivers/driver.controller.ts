import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import {
  driverCreateDriver,
  driverDeleteDriver,
  driverGetDashboard,
  driverGetTrackingSettings,
  driverListSchedulableRoutes,
  driverTrackTripLocation,
  driverGetTripDetails,
  driverListDrivers,
  driverListActiveTrips,
  driverListHistoryTrips,
  driverGetTripManagement,
  driverReportEmergency,
  driverScheduleTrip,
  driverUpdateDriver,
  driverViewProfile,
} from "./driver.service";
import type {
  DriverCreateBody,
  DriverEmergencyBody,
  DriverIdParams,
  DriverLocationBody,
  DriverScheduleTripBody,
  DriverTripIdParams,
  DriverUpdateBody,
} from "./driver.validation";

export const driverGetProfile = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await driverViewProfile(req.authUser!.userId);
  sendSuccess(res, result, "Driver profile loaded");
});

export const driverGetDashboardSummary = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await driverGetDashboard(req.authUser!.userId);
  sendSuccess(res, result, "Driver dashboard loaded");
});

export const driverTrackingSettings = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await driverGetTrackingSettings();
  sendSuccess(res, result, "Driver tracking settings loaded");
});

export const driverGetManagementTrip = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as DriverTripIdParams;
  const result = await driverGetTripManagement(req.authUser!.userId, params.tripId);
  sendSuccess(res, result, "Driver trip management loaded");
});

export const driverGetAssignedTrips = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await driverListActiveTrips(req.authUser!.userId);
  sendSuccess(res, result, "Driver active trips loaded");
});

export const driverGetSchedulableRoutes = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await driverListSchedulableRoutes();
  sendSuccess(res, result, "Driver schedulable routes loaded");
});

export const driverScheduleAssignedTrip = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as DriverScheduleTripBody;
  const result = await driverScheduleTrip(req.authUser!.userId, body);
  sendSuccess(res, result, "Driver trip scheduled", 201);
});

export const driverGetTripHistory = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await driverListHistoryTrips(req.authUser!.userId);
  sendSuccess(res, result, "Driver trip history loaded");
});

export const driverGetTripById = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as DriverTripIdParams;
  const result = await driverGetTripDetails(req.authUser!.userId, params.tripId);
  sendSuccess(res, result, "Driver trip loaded");
});

export const driverEmergency = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as DriverEmergencyBody;
  const params = req.params as unknown as DriverTripIdParams;
  const result = await driverReportEmergency(req.authUser!.userId, params.tripId, body);
  sendSuccess(res, result, "Driver emergency reported");
});

export const driverUpdateLocation = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as DriverLocationBody;
  const params = req.params as unknown as DriverTripIdParams;
  const result = await driverTrackTripLocation(req.authUser!.userId, params.tripId, body);
  sendSuccess(res, result, "Driver location updated");
});

export const driverGetAllDrivers = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await driverListDrivers();
  sendSuccess(res, result, "Drivers loaded");
});

export const driverCreate = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as DriverCreateBody;
  const result = await driverCreateDriver(body, req.authUser?.userId);
  sendSuccess(res, result, "Driver created", 201);
});

export const driverUpdate = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as DriverUpdateBody;
  const params = req.params as unknown as DriverIdParams;
  const result = await driverUpdateDriver(params.driverId, body, req.authUser?.userId);
  sendSuccess(res, result, "Driver updated");
});

export const driverDelete = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as DriverIdParams;
  const result = await driverDeleteDriver(params.driverId, req.authUser?.userId);
  sendSuccess(res, result, "Driver deleted");
});
