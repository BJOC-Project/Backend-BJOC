import { describe, expect, it } from "vitest";
import { calculateMinimumRouteDistanceMeters } from "../../modules/drivers/driver-location.utils";

describe("driver location utilities", () => {
  it("returns near-zero distance for a point along the route line", () => {
    const distance = calculateMinimumRouteDistanceMeters([
      { latitude: 14.44, longitude: 120.96 },
      { latitude: 14.45, longitude: 120.97 },
    ], {
      latitude: 14.445,
      longitude: 120.965,
    });

    expect(distance).not.toBeNull();
    expect(distance!).toBeLessThan(5);
  });

  it("returns a larger distance for a point far from the route", () => {
    const distance = calculateMinimumRouteDistanceMeters([
      { latitude: 14.44, longitude: 120.96 },
      { latitude: 14.45, longitude: 120.97 },
    ], {
      latitude: 14.455,
      longitude: 120.985,
    });

    expect(distance).not.toBeNull();
    expect(distance!).toBeGreaterThan(1500);
  });
});
