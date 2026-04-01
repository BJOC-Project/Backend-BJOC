import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import {
  vehicleCreateVehicle,
  vehicleDeleteVehicle,
  vehicleListLocations,
  vehicleListVehicles,
  vehicleUpdateVehicle,
} from "./vehicles.service";
import type {
  CreateVehicleBody,
  UpdateVehicleBody,
  VehicleIdParams,
} from "./vehicles.validation";

export const vehicleGetAll = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await vehicleListVehicles();
  sendSuccess(res, result, "Vehicles loaded");
});

export const vehicleCreate = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as CreateVehicleBody;
  const result = await vehicleCreateVehicle(body, req.authUser?.userId);
  sendSuccess(res, result, "Vehicle created", 201);
});

export const vehicleUpdate = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as UpdateVehicleBody;
  const params = req.params as unknown as VehicleIdParams;
  const result = await vehicleUpdateVehicle(params.vehicleId, body, req.authUser?.userId);
  sendSuccess(res, result, "Vehicle updated");
});

export const vehicleDelete = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as VehicleIdParams;
  const result = await vehicleDeleteVehicle(params.vehicleId, req.authUser?.userId);
  sendSuccess(res, result, "Vehicle deleted");
});

export const vehicleGetLocations = asyncHandler(async (
  _req: Request,
  res: Response,
) => {
  const result = await vehicleListLocations();
  sendSuccess(res, result, "Vehicle locations loaded");
});
