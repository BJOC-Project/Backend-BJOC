import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import {
  adminGetAlerts,
  adminGetAppRatingsByFilter,
  adminGetDashboardSummary,
  adminGetDriverPerformance,
  adminGetLiveMap,
  adminGetNotifications,
  adminGetRoutes,
  adminGetSuggestions,
  adminGetVehicleStatus,
  adminGetWaitingStops,
  adminListUsers,
  adminViewProfile,
} from "./admin.service";
import type {
  DashboardFilterQuery,
  WaitingStopsQuery,
} from "./admin.validation";

export const adminGetUsers = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await adminListUsers(req.query);
  sendSuccess(res, result.items, "Users loaded", 200, result.meta);
});

export const adminGetProfile = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await adminViewProfile(req.authUser!.userId);
  sendSuccess(res, result, "Admin profile loaded");
});

export const adminGetDashboard = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as DashboardFilterQuery;
  const result = await adminGetDashboardSummary(query.filter);
  sendSuccess(res, result, "Admin dashboard summary loaded");
});

export const adminVehicleStatus = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await adminGetVehicleStatus();
  sendSuccess(res, result, "Admin vehicle status loaded");
});

export const adminRoutes = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await adminGetRoutes();
  sendSuccess(res, result, "Admin routes loaded");
});

export const adminWaitingStops = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as WaitingStopsQuery;
  const result = await adminGetWaitingStops(query.routeId, query.filter);
  sendSuccess(res, result, "Passenger waiting trend loaded");
});

export const adminDriverPerformance = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as DashboardFilterQuery;
  const result = await adminGetDriverPerformance(query.filter);
  sendSuccess(res, result, "Driver performance loaded");
});

export const adminAlerts = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await adminGetAlerts();
  sendSuccess(res, result, "Admin alerts loaded");
});

export const adminNotifications = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await adminGetNotifications(req.authUser!.userId);
  sendSuccess(res, result, "Admin notifications loaded");
});

export const adminAppRatings = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as DashboardFilterQuery;
  const result = await adminGetAppRatingsByFilter(query.filter);
  sendSuccess(res, result, "App ratings loaded");
});

export const adminSuggestions = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as DashboardFilterQuery;
  const result = await adminGetSuggestions(query.filter);
  sendSuccess(res, result, "Suggestions loaded");
});

export const adminLiveMap = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await adminGetLiveMap();
  sendSuccess(res, result, "Live map loaded");
});
