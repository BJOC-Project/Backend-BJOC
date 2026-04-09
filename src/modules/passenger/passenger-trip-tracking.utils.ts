const EARTH_RADIUS_KM = 6371;
const PASSAGE_DISTANCE_THRESHOLD_KM = 0.35;
const ROUTE_STOP_INTERVAL_MINUTES = 5;
const AVG_ROUTE_SPEED_KPH = 18;
const INTERMEDIATE_STOP_DELAY_MINUTES = 1;

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

function hasStopCoordinates(
  stop: PassengerTrackingRouteStop,
): stop is PassengerTrackingRouteStop & { latitude: number; longitude: number } {
  return typeof stop.latitude === "number" && typeof stop.longitude === "number";
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

function calculatePathDistanceKm(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length < 2) {
    return 0;
  }

  let totalDistanceKm = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const currentPoint = points[index];

    totalDistanceKm += haversineDistanceKm(
      previousPoint.latitude,
      previousPoint.longitude,
      currentPoint.latitude,
      currentPoint.longitude,
    );
  }

  return totalDistanceKm;
}

export function estimateTravelMinutesFromDistance(input: {
  distanceKm: number | null;
  intermediateStopCount?: number;
}) {
  if (typeof input.distanceKm !== "number" || !Number.isFinite(input.distanceKm)) {
    return null;
  }

  const distanceKm = Math.max(0, input.distanceKm);
  const baseTravelMinutes = (distanceKm / AVG_ROUTE_SPEED_KPH) * 60;
  const stopDelayMinutes =
    Math.max(0, Math.floor(input.intermediateStopCount ?? 0)) * INTERMEDIATE_STOP_DELAY_MINUTES;
  const estimatedMinutes = baseTravelMinutes + stopDelayMinutes;

  if (distanceKm > 0 && estimatedMinutes < 1) {
    return 1;
  }

  return clampMinutes(estimatedMinutes);
}

export function estimateRemainingRouteDistanceKm(input: {
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  currentStopOrder: number | null;
  routeStops: PassengerTrackingRouteStop[];
  targetStopOrder: number | null;
}) {
  if (typeof input.targetStopOrder !== "number") {
    return null;
  }

  if (
    typeof input.currentStopOrder === "number" &&
    input.targetStopOrder <= input.currentStopOrder
  ) {
    return 0;
  }

  const orderedStops = [...input.routeStops]
    .filter(hasStopCoordinates)
    .sort((left, right) => left.stopOrder - right.stopOrder);
  const targetStopIndex = orderedStops.findIndex((stop) => stop.stopOrder === input.targetStopOrder);

  if (targetStopIndex < 0) {
    return null;
  }

  let startingStopIndex = 0;

  if (typeof input.currentStopOrder === "number") {
    const currentStopIndex = orderedStops.findIndex((stop) => stop.stopOrder >= input.currentStopOrder!);

    if (currentStopIndex >= 0) {
      startingStopIndex = currentStopIndex;

      const nextStop = orderedStops[currentStopIndex + 1];
      const canUseLiveLocation =
        typeof input.currentLatitude === "number" &&
        typeof input.currentLongitude === "number";

      if (canUseLiveLocation && nextStop) {
        const currentStop = orderedStops[currentStopIndex];
        const distanceToCurrentStopKm = haversineDistanceKm(
          input.currentLatitude!,
          input.currentLongitude!,
          currentStop.latitude,
          currentStop.longitude,
        );
        const distanceToNextStopKm = haversineDistanceKm(
          input.currentLatitude!,
          input.currentLongitude!,
          nextStop.latitude,
          nextStop.longitude,
        );

        if (distanceToNextStopKm < distanceToCurrentStopKm) {
          startingStopIndex = currentStopIndex + 1;
        }
      }
    }
  }

  const remainingStops = orderedStops.slice(startingStopIndex, targetStopIndex + 1);

  if (remainingStops.length === 0) {
    return 0;
  }

  const pathPoints: Array<{ latitude: number; longitude: number }> = [];
  const canUseLiveLocation =
    typeof input.currentLatitude === "number" &&
    typeof input.currentLongitude === "number";

  if (canUseLiveLocation) {
    pathPoints.push({
      latitude: input.currentLatitude!,
      longitude: input.currentLongitude!,
    });
  }

  for (const stop of remainingStops) {
    const lastPoint = pathPoints[pathPoints.length - 1];

    if (
      lastPoint &&
      Math.abs(lastPoint.latitude - stop.latitude) < 0.000001 &&
      Math.abs(lastPoint.longitude - stop.longitude) < 0.000001
    ) {
      continue;
    }

    pathPoints.push({
      latitude: stop.latitude,
      longitude: stop.longitude,
    });
  }

  if (pathPoints.length < 2) {
    return 0;
  }

  return calculatePathDistanceKm(pathPoints);
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
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  currentStopOrder: number | null;
  now?: Date;
  routeStops?: PassengerTrackingRouteStop[];
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

  if (Array.isArray(input.routeStops) && input.routeStops.length > 0) {
    const remainingRouteDistanceKm = estimateRemainingRouteDistanceKm({
      currentLatitude: input.currentLatitude,
      currentLongitude: input.currentLongitude,
      currentStopOrder: input.currentStopOrder,
      routeStops: input.routeStops,
      targetStopOrder: input.targetStopOrder,
    });
    const liveEtaMinutes = estimateTravelMinutesFromDistance({
      distanceKm: remainingRouteDistanceKm,
      intermediateStopCount: Math.max(0, input.targetStopOrder - input.currentStopOrder - 1),
    });

    if (typeof liveEtaMinutes === "number") {
      return liveEtaMinutes;
    }
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
