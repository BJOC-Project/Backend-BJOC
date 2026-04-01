import {
  operationsAssignDriverToVehicle,
  operationsGetOperatorActiveStops,
  operationsGetOperatorDrivers,
  operationsGetOperatorFleetSummary,
  operationsGetOperatorJeepneys,
  operationsGetOperatorLoadSummary,
  operationsGetOperatorOverallSummary,
  operationsGetOperatorStopPopularity,
  operationsGetOperatorVehicleLocations,
  operationsGetOperatorVehicles,
} from "../operations/operations.service";
import type { AssignDriverBody } from "./operators.validation";

export function operatorGetVehicles() {
  return operationsGetOperatorVehicles();
}

export function operatorGetDrivers() {
  return operationsGetOperatorDrivers();
}

export function operatorAssignDriver(
  input: AssignDriverBody,
  actorUserId?: string,
) {
  return operationsAssignDriverToVehicle(input.vehicle_id, input.driver_id, actorUserId);
}

export function operatorGetFleetSummary() {
  return operationsGetOperatorFleetSummary();
}

export function operatorGetJeepneys() {
  return operationsGetOperatorJeepneys();
}

export function operatorGetStopPopularity() {
  return operationsGetOperatorStopPopularity();
}

export function operatorGetLoadSummary() {
  return operationsGetOperatorLoadSummary();
}

export function operatorGetActiveStops() {
  return operationsGetOperatorActiveStops();
}

export function operatorGetOverallSummary() {
  return operationsGetOperatorOverallSummary();
}

export function operatorGetVehicleLocations() {
  return operationsGetOperatorVehicleLocations();
}
