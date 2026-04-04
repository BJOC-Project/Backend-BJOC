type GeoPoint = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(
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

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function projectCoordinateToMeters(
  point: GeoPoint,
  referenceLatitudeRadians: number,
) {
  return {
    x: EARTH_RADIUS_METERS * toRadians(point.longitude) * Math.cos(referenceLatitudeRadians),
    y: EARTH_RADIUS_METERS * toRadians(point.latitude),
  };
}

function distancePointToSegmentMeters(
  point: { x: number; y: number },
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number },
) {
  const deltaX = segmentEnd.x - segmentStart.x;
  const deltaY = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = deltaX ** 2 + deltaY ** 2;

  if (segmentLengthSquared === 0) {
    return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentStart.x) * deltaX + (point.y - segmentStart.y) * deltaY) / segmentLengthSquared,
    ),
  );

  const closestPoint = {
    x: segmentStart.x + projection * deltaX,
    y: segmentStart.y + projection * deltaY,
  };

  return Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y);
}

export function calculateMinimumRouteDistanceMeters(
  routePoints: GeoPoint[],
  trackedPoint: GeoPoint,
) {
  const validRoutePoints = routePoints.filter((point) =>
    Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
  );

  if (validRoutePoints.length === 0) {
    return null;
  }

  if (validRoutePoints.length === 1) {
    return haversineDistanceMeters(
      trackedPoint.latitude,
      trackedPoint.longitude,
      validRoutePoints[0].latitude,
      validRoutePoints[0].longitude,
    );
  }

  const averageLatitude =
    (trackedPoint.latitude +
      validRoutePoints.reduce((total, point) => total + point.latitude, 0) / validRoutePoints.length) / 2;
  const referenceLatitudeRadians = toRadians(averageLatitude);
  const projectedPoint = projectCoordinateToMeters(trackedPoint, referenceLatitudeRadians);

  let minimumDistanceMeters = Number.POSITIVE_INFINITY;

  for (let index = 0; index < validRoutePoints.length - 1; index += 1) {
    const segmentStart = projectCoordinateToMeters(validRoutePoints[index], referenceLatitudeRadians);
    const segmentEnd = projectCoordinateToMeters(validRoutePoints[index + 1], referenceLatitudeRadians);
    const distanceMeters = distancePointToSegmentMeters(projectedPoint, segmentStart, segmentEnd);

    if (distanceMeters < minimumDistanceMeters) {
      minimumDistanceMeters = distanceMeters;
    }
  }

  return Number.isFinite(minimumDistanceMeters) ? minimumDistanceMeters : null;
}
