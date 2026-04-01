import {
  operationsCancelTrip,
  operationsEndTrip,
  operationsListActiveTrips,
  operationsListTripHistory,
  operationsRescheduleTrip,
  operationsScheduleTrip,
  operationsStartTrip,
} from "../operations/operations.service";
import type { RescheduleTripBody, ScheduleTripBody, TripEndBody } from "./trips.validation";

export function tripListActiveTrips() {
  return operationsListActiveTrips();
}

export function tripListHistory() {
  return operationsListTripHistory();
}

export function tripScheduleTrip(
  input: ScheduleTripBody,
  actorUserId: string,
) {
  return operationsScheduleTrip(input, actorUserId);
}

export function tripStartTrip(
  tripId: string,
  actorUserId?: string,
) {
  return operationsStartTrip(tripId, actorUserId);
}

export function tripEndTrip(
  tripId: string,
  input: TripEndBody,
  actorUserId?: string,
) {
  return operationsEndTrip(tripId, input, actorUserId);
}

export function tripCancelTrip(
  tripId: string,
  actorUserId?: string,
) {
  return operationsCancelTrip(tripId, actorUserId);
}

export function tripRescheduleTrip(
  tripId: string,
  input: RescheduleTripBody,
  actorUserId?: string,
) {
  return operationsRescheduleTrip(tripId, input, actorUserId);
}
