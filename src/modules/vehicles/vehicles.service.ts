import {
  operationsCreateVehicle,
  operationsDeleteVehicle,
  operationsListVehicleLocations,
  operationsListVehicles,
  operationsUpdateVehicle,
} from "../operations/operations.service";
import type { CreateVehicleBody, UpdateVehicleBody } from "./vehicles.validation";

export function vehicleListVehicles() {
  return operationsListVehicles();
}

export function vehicleCreateVehicle(
  input: CreateVehicleBody,
  actorUserId?: string,
) {
  return operationsCreateVehicle(input, actorUserId);
}

export function vehicleUpdateVehicle(
  vehicleId: string,
  input: UpdateVehicleBody,
  actorUserId?: string,
) {
  return operationsUpdateVehicle(vehicleId, input, actorUserId);
}

export function vehicleDeleteVehicle(
  vehicleId: string,
  actorUserId?: string,
) {
  return operationsDeleteVehicle(vehicleId, actorUserId);
}

export function vehicleListLocations() {
  return operationsListVehicleLocations();
}
