import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import {
  reportsGetDailyTrend,
  reportsGetDriverPerformance,
  reportsGetPassengerVolume,
  reportsGetPeakHours,
  reportsGetTripHistory,
} from "./reports.service";
import type { ReportQuery } from "./reports.validation";

export const reportGetTrips = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as ReportQuery;
  const result = await reportsGetTripHistory(query);
  sendSuccess(res, result, "Trip report loaded");
});

export const reportGetPassengerVolume = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as ReportQuery;
  const result = await reportsGetPassengerVolume(query);
  sendSuccess(res, result, "Passenger volume report loaded");
});

export const reportGetPeakHours = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as ReportQuery;
  const result = await reportsGetPeakHours(query);
  sendSuccess(res, result, "Peak hours report loaded");
});

export const reportGetDailyTrend = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as ReportQuery;
  const result = await reportsGetDailyTrend(query);
  sendSuccess(res, result, "Daily trend report loaded");
});

export const reportGetDrivers = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as ReportQuery;
  const result = await reportsGetDriverPerformance(query);
  sendSuccess(res, result, "Driver report loaded");
});
