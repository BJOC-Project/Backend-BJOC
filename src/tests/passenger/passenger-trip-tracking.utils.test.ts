import { describe, expect, it } from "vitest";
import {
  buildPassengerStopProgress,
  estimatePassengerEtaMinutes,
  inferStopPassageTimes,
  resolvePassengerTrackingTarget,
  type PassengerTrackingGpsPoint,
  type PassengerTrackingRouteStop,
} from "../../modules/passenger/passenger-trip-tracking.utils";

const routeStops: PassengerTrackingRouteStop[] = [
  {
    id: "stop-1",
    latitude: 14.405,
    longitude: 120.925,
    stopName: "Bucandala",
    stopOrder: 1,
  },
  {
    id: "stop-2",
    latitude: 14.408,
    longitude: 120.928,
    stopName: "Stop 2",
    stopOrder: 2,
  },
  {
    id: "stop-3",
    latitude: 14.411,
    longitude: 120.931,
    stopName: "Patindig",
    stopOrder: 3,
  },
];

const gpsPoints: PassengerTrackingGpsPoint[] = [
  {
    latitude: 14.40502,
    longitude: 120.92501,
    recordedAt: new Date("2026-04-06T05:00:00.000Z"),
  },
  {
    latitude: 14.40804,
    longitude: 120.92802,
    recordedAt: new Date("2026-04-06T05:05:00.000Z"),
  },
];

describe("passenger trip tracking utils", () => {
  it("keeps pickup as the tracking target until the passenger is onboard", () => {
    expect(resolvePassengerTrackingTarget("booked", "scheduled")).toBe("pickup");
    expect(resolvePassengerTrackingTarget("waiting", "ongoing")).toBe("pickup");
    expect(resolvePassengerTrackingTarget("onboard", "ongoing")).toBe("dropoff");
    expect(resolvePassengerTrackingTarget("completed", "completed")).toBeNull();
  });

  it("estimates eta from the current stop when the trip is ongoing", () => {
    expect(estimatePassengerEtaMinutes({
      currentStopOrder: 1,
      scheduledDepartureTime: new Date("2026-04-06T05:00:00.000Z"),
      targetStopOrder: 3,
      tripStatus: "ongoing",
    })).toBe(10);
  });

  it("infers passed timestamps from gps points in route order", () => {
    const passedAtByStopId = inferStopPassageTimes({
      currentStopId: "stop-2",
      currentStopOrder: 2,
      currentStopUpdatedAt: new Date("2026-04-06T05:05:30.000Z"),
      gpsPoints,
      routeStops,
    });

    expect(passedAtByStopId.get("stop-1")?.toISOString()).toBe("2026-04-06T05:00:00.000Z");
    expect(passedAtByStopId.get("stop-2")?.toISOString()).toBe("2026-04-06T05:05:30.000Z");
    expect(passedAtByStopId.has("stop-3")).toBe(false);
  });

  it("builds passenger stop progress with pickup, dropoff, and passed state", () => {
    const stopProgress = buildPassengerStopProgress({
      currentStopId: "stop-2",
      currentStopOrder: 2,
      currentStopUpdatedAt: new Date("2026-04-06T05:05:30.000Z"),
      dropoffStopId: "stop-3",
      gpsPoints,
      pickupStopId: "stop-2",
      routeStops,
      scheduledDepartureTime: new Date("2026-04-06T05:00:00.000Z"),
      tripStatus: "ongoing",
    });

    expect(stopProgress.map((stopRow) => ({
      id: stopRow.id,
      isDropoff: stopRow.isDropoff,
      isPickup: stopRow.isPickup,
      passedAt: stopRow.passedAt?.toISOString() ?? null,
      status: stopRow.status,
    }))).toEqual([
      {
        id: "stop-1",
        isDropoff: false,
        isPickup: false,
        passedAt: "2026-04-06T05:00:00.000Z",
        status: "passed",
      },
      {
        id: "stop-2",
        isDropoff: false,
        isPickup: true,
        passedAt: "2026-04-06T05:05:30.000Z",
        status: "current",
      },
      {
        id: "stop-3",
        isDropoff: true,
        isPickup: false,
        passedAt: null,
        status: "upcoming",
      },
    ]);
  });
});
