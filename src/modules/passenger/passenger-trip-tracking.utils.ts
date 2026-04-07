const EARTH_RADIUS_KM = 6371;
const PASSAGE_DISTANCE_THRESHOLD_KM = 0.35;
const ROUTE_STOP_INTERVAL_MINUTES = 5;

export type PassengerTrackingStopStatus = "passed" | "current" | "upcoming";
export type PassengerTrackingTarget = "dropoff" | "pickup";
export type PassengerTrackingTripStatus = "scheduled" | "ongoing" | "completed" | "cancelled";
export type PassengerTrackingBookingStatus = "booked" | "waiting" | "onboard" | "completed" | "cancelled";

export interface PassengerTrackingRouteStop {
  id: string;
  latitude: number | null;
  longitude: number | null;
  stopName: string | null;
  stopOrder: number;
}

export interface PassengerTrackingGpsPoint {
  latitude: number | null;
  longitude: number | null;
  recordedAt: Date;
}

export interface PassengerTrackingStopProgress {
  id: string;
  isDropoff: boolean;
  isPickup: boolean;
  passedAt: Date | null;
  scheduledTime: Date;
  status: PassengerTrackingStopStatus;
  stopName: string;
  stopOrder: number;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function addMinutes(
  baseDate: Date,
  minutesToAdd: number,
) {
  return new Date(baseDate.getTime() + minutesToAdd * 60_000);
}

function clampMinutes(value: number) {
  return Math.max(0, Math.round(value));
}

export function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const startLatitude = toRadians(latitudeA);
  const endLatitude = toRadians(latitudeB);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function resolvePassengerTrackingTarget(
  bookingStatus: PassengerTrackingBookingStatus,
  tripStatus: PassengerTrackingTripStatus,
) {
  if (bookingStatus === "cancelled" || bookingStatus === "completed") {
    return null;
  }

  if (tripStatus === "cancelled" || tripStatus === "completed") {
    return null;
  }

  if (bookingStatus === "onboard") {
    return "dropoff";
  }

  return "pickup";
}

export function derivePassengerStopStatus(
  tripStatus: PassengerTrackingTripStatus,
  currentStopOrder: number | null,
  stopOrder: number,
): PassengerTrackingStopStatus {
  if (tripStatus === "completed") {
    return "passed";
  }

  if (currentStopOrder === null || tripStatus === "scheduled") {
    return "upcoming";
  }

  if (stopOrder < currentStopOrder) {
    return "passed";
  }

  if (stopOrder === currentStopOrder) {
    return "current";
  }

  return "upcoming";
}

export function estimatePassengerEtaMinutes(input: {
  currentStopOrder: number | null;
  now?: Date;
  scheduledDepartureTime: Date;
  targetStopOrder: number | null;
  tripStatus: PassengerTrackingTripStatus;
}) {
  if (typeof input.targetStopOrder !== "number") {
    return null;
  }

  if (input.tripStatus === "completed" || input.tripStatus === "cancelled") {
    return 0;
  }

  const now = input.now ?? new Date();
  const scheduledTargetTime = addMinutes(
    input.scheduledDepartureTime,
    Math.max(0, input.targetStopOrder - 1) * ROUTE_STOP_INTERVAL_MINUTES,
  );

  if (input.tripStatus === "scheduled" || input.currentStopOrder === null) {
    return clampMinutes((scheduledTargetTime.getTime() - now.getTime()) / 60_000);
  }

  if (input.targetStopOrder <= input.currentStopOrder) {
    return 0;
  }

  return Math.max(0, input.targetStopOrder - input.currentStopOrder) * ROUTE_STOP_INTERVAL_MINUTES;
}

export function inferStopPassageTimes(input: {
  currentStopId: string | null;
  currentStopOrder: number | null;
  currentStopUpdatedAt: Date | null;
  gpsPoints: PassengerTrackingGpsPoint[];
  routeStops: PassengerTrackingRouteStop[];
}) {
  const passedAtByStopId = new Map<string, Date>();

  if (input.routeStops.length === 0) {
    return passedAtByStopId;
  }

  const eligibleStops = typeof input.currentStopOrder === "number"
    ? input.routeStops.filter((stopRow) => stopRow.stopOrder <= input.currentStopOrder!)
    : [];
  const gpsPoints = input.gpsPoints.filter((point) =>
    typeof point.latitude === "number" &&
    typeof point.longitude === "number"
  );
  let gpsCursor = 0;

  for (const stopRow of eligibleStops) {
    if (typeof stopRow.latitude !== "number" || typeof stopRow.longitude !== "number") {
      continue;
    }

    for (let index = gpsCursor; index < gpsPoints.length; index += 1) {
      const point = gpsPoints[index];
      const distanceKm = haversineDistanceKm(
        point.latitude as number,
        point.longitude as number,
        stopRow.latitude,
        stopRow.longitude,
      );

      if (distanceKm <= PASSAGE_DISTANCE_THRESHOLD_KM) {
        passedAtByStopId.set(stopRow.id, point.recordedAt);
        gpsCursor = index + 1;
        break;
      }
    }
  }

  if (input.currentStopId && input.currentStopUpdatedAt) {
    const existingTimestamp = passedAtByStopId.get(input.currentStopId);

    if (
      !existingTimestamp ||
      existingTimestamp.getTime() < input.currentStopUpdatedAt.getTime()
    ) {
      passedAtByStopId.set(input.currentStopId, input.currentStopUpdatedAt);
    }
  }

  return passedAtByStopId;
}

export function buildPassengerStopProgress(input: {
  currentStopId: string | null;
  currentStopOrder: number | null;
  currentStopUpdatedAt: Date | null;
  dropoffStopId: string | null;
  gpsPoints: PassengerTrackingGpsPoint[];
  pickupStopId: string | null;
  routeStops: PassengerTrackingRouteStop[];
  scheduledDepartureTime: Date;
  tripStatus: PassengerTrackingTripStatus;
}) {
  const passedAtByStopId = inferStopPassageTimes({
    currentStopId: input.currentStopId,
    currentStopOrder: input.currentStopOrder,
    currentStopUpdatedAt: input.currentStopUpdatedAt,
    gpsPoints: input.gpsPoints,
    routeStops: input.routeStops,
  });

  return input.routeStops.map((stopRow) => ({
    id: stopRow.id,
    isDropoff: input.dropoffStopId === stopRow.id,
    isPickup: input.pickupStopId === stopRow.id,
    passedAt: passedAtByStopId.get(stopRow.id) ?? null,
    scheduledTime: addMinutes(
      input.scheduledDepartureTime,
      Math.max(0, stopRow.stopOrder - 1) * ROUTE_STOP_INTERVAL_MINUTES,
    ),
    status: derivePassengerStopStatus(
      input.tripStatus,
      input.currentStopOrder,
      stopRow.stopOrder,
    ),
    stopName: stopRow.stopName?.trim() || `Stop ${stopRow.stopOrder}`,
    stopOrder: stopRow.stopOrder,
  }));
}
