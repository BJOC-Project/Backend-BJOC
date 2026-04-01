import {
  operationsCreateStop,
  operationsDeleteStop,
  operationsListStops,
  operationsReorderStops,
  operationsToggleStopStatus,
  operationsUpdateStop,
} from "../operations/operations.service";
import type {
  CreateStopBody,
  ReorderStopsBody,
  ToggleStopStatusBody,
  UpdateStopBody,
} from "./stops.validation";

export function stopListStops(routeId?: string) {
  return operationsListStops(routeId);
}

export function stopCreateStop(
  input: CreateStopBody,
  actorUserId?: string,
) {
  return operationsCreateStop(input, actorUserId);
}

export function stopUpdateStop(
  stopId: string,
  input: UpdateStopBody,
  actorUserId?: string,
) {
  return operationsUpdateStop(stopId, input, actorUserId);
}

export function stopDeleteStop(
  stopId: string,
  actorUserId?: string,
) {
  return operationsDeleteStop(stopId, actorUserId);
}

export function stopToggleStatus(
  stopId: string,
  input: ToggleStopStatusBody,
  actorUserId?: string,
) {
  return operationsToggleStopStatus(stopId, input.is_active, actorUserId);
}

export function stopReorderStops(
  routeId: string,
  input: ReorderStopsBody,
  actorUserId?: string,
) {
  return operationsReorderStops(routeId, input, actorUserId);
}
