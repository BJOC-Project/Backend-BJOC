import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import {
  operatorAssignDriver,
  operatorGetActiveStops,
  operatorGetDrivers,
  operatorGetFleetSummary,
  operatorGetJeepneys,
  operatorGetLoadSummary,
  operatorGetOverallSummary,
  operatorGetStopPopularity,
  operatorGetVehicleLocations,
  operatorGetVehicles,
} from "./operators.service";
import type { AssignDriverBody } from "./operators.validation";

export const operatorVehicles = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await operatorGetVehicles();
  sendSuccess(res, result, "Operator vehicles loaded");
});

export const operatorDrivers = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await operatorGetDrivers();
  sendSuccess(res, result, "Operator drivers loaded");
});

export const operatorAssign = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as AssignDriverBody;
  const result = await operatorAssignDriver(body, req.authUser?.userId);
  sendSuccess(res, result, "Driver assigned");
});

export const operatorFleetSummary = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await operatorGetFleetSummary();
  sendSuccess(res, result, "Fleet summary loaded");
});

export const operatorJeepneys = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await operatorGetJeepneys();
  sendSuccess(res, result, "Jeepneys loaded");
});

export const operatorStopStats = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await operatorGetStopPopularity();
  sendSuccess(res, result, "Stop popularity loaded");
});

export const operatorLoadStats = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await operatorGetLoadSummary();
  sendSuccess(res, result, "Load summary loaded");
});

export const operatorActiveStopStats = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await operatorGetActiveStops();
  sendSuccess(res, result, "Active stops loaded");
});

export const operatorOverall = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await operatorGetOverallSummary();
  sendSuccess(res, result, "Overall summary loaded");
});

export const operatorLocations = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await operatorGetVehicleLocations();
  sendSuccess(res, result, "Operator vehicle locations loaded");
});
