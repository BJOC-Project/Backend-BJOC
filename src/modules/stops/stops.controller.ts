import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import {
  stopCreateStop,
  stopDeleteStop,
  stopListStops,
  stopReorderStops,
  stopToggleStatus,
  stopUpdateStop,
} from "./stops.service";
import type {
  CreateStopBody,
  ReorderStopsBody,
  RouteIdParams,
  StopIdParams,
  ToggleStopStatusBody,
  UpdateStopBody,
} from "./stops.validation";

export const stopGetAll = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const routeId = typeof req.query.routeId === "string"
    ? req.query.routeId
    : undefined;
  const result = await stopListStops(routeId);
  sendSuccess(res, result, "Stops loaded");
});

export const stopGetByRoute = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as RouteIdParams;
  const result = await stopListStops(params.routeId);
  sendSuccess(res, result, "Route stops loaded");
});

export const stopCreate = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as CreateStopBody;
  const result = await stopCreateStop(body, req.authUser?.userId);
  sendSuccess(res, result, "Stop created", 201);
});

export const stopUpdate = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as UpdateStopBody;
  const params = req.params as unknown as StopIdParams;
  const result = await stopUpdateStop(params.stopId, body, req.authUser?.userId);
  sendSuccess(res, result, "Stop updated");
});

export const stopDelete = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as StopIdParams;
  const result = await stopDeleteStop(params.stopId, req.authUser?.userId);
  sendSuccess(res, result, "Stop deleted");
});

export const stopToggle = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as ToggleStopStatusBody;
  const params = req.params as unknown as StopIdParams;
  const result = await stopToggleStatus(params.stopId, body, req.authUser?.userId);
  sendSuccess(res, result, "Stop status updated");
});

export const stopReorder = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as ReorderStopsBody;
  const params = req.params as unknown as RouteIdParams;
  const result = await stopReorderStops(params.routeId, body, req.authUser?.userId);
  sendSuccess(res, result, "Stop order updated");
});
