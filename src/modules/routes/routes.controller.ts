import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import { NotFoundError } from "../../errors/app-error";
import {
  bookRouteForPassenger,
  findBestRoute,
  getStopArrivalEta,
  getVehicleProgress,
  listPassengerRouteOptions,
  planRouteSegmentForPassenger,
  routeCreateRoute,
  routeDeleteRoute,
  routeListRoutes,
  routePublishRoute,
  routeToggleStatus,
  routeUpdateRoute,
} from "./routes.service";
import type {
  BookRouteBody,
  CreateRouteBody,
  PlanRouteQuery,
  RouteIdParams,
  RouteSegmentQuery,
  RouteStatusBody,
  StopEtaQuery,
  UpdateRouteBody,
} from "./routes.validation";

export const planRoute = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as PlanRouteQuery;
  const result = await findBestRoute(query);

  if (!result) {
    throw new NotFoundError("No direct jeepney route found for this journey.");
  }

  sendSuccess(res, result, "Route plan generated");
});

export const bookRoute = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as BookRouteBody;
  const result = await bookRouteForPassenger(req.authUser!.userId, body);

  sendSuccess(res, result, "Route booked successfully", 201);
});

export const routeGetPassengerOptions = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await listPassengerRouteOptions();
  sendSuccess(res, result, "Passenger route options loaded");
});

export const routePlanSegment = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as RouteSegmentQuery;
  const result = await planRouteSegmentForPassenger(query);
  sendSuccess(res, result, "Passenger stop-based route plan generated");
});

export const routeGetAll = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await routeListRoutes();
  sendSuccess(res, result, "Routes loaded");
});

export const routeCreate = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as CreateRouteBody;
  const result = await routeCreateRoute(body, req.authUser?.userId);
  sendSuccess(res, result, "Route created", 201);
});

export const routeUpdate = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as UpdateRouteBody;
  const params = req.params as unknown as RouteIdParams;
  const result = await routeUpdateRoute(params.routeId, body, req.authUser?.userId);
  sendSuccess(res, result, "Route updated");
});

export const routeDelete = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as RouteIdParams;
  const result = await routeDeleteRoute(params.routeId, req.authUser?.userId);
  sendSuccess(res, result, "Route deleted");
});

export const routePublish = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as RouteIdParams;
  const result = await routePublishRoute(params.routeId, req.authUser?.userId);
  sendSuccess(res, result, "Route published");
});

export const routeToggle = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as RouteIdParams;
  const body = req.body as RouteStatusBody;
  const result = await routeToggleStatus(params.routeId, body.is_active, req.authUser?.userId);
  sendSuccess(res, result, body.is_active ? "Route activated" : "Route deactivated");
});

export const routeGetStopEta = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as StopEtaQuery;
  const result = await getStopArrivalEta(query.stopId);
  sendSuccess(res, result, "Stop arrival ETA loaded");
});

export const routeGetVehicleProgress = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as StopEtaQuery;
  const result = await getVehicleProgress(query.stopId);
  sendSuccess(res, result, "Vehicle progress loaded");
});
