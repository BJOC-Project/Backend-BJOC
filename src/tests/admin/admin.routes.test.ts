import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../app";
import { createTestAccessToken } from "../helpers/auth";

describe("admin routes", () => {
  it("returns 403 when a driver accesses maintenance settings", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .get("/api/admin/settings/maintenance")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("returns 400 when maintenance settings are outside allowed range", async () => {
    const adminToken = createTestAccessToken("admin");

    const response = await request(app)
      .patch("/api/admin/settings/maintenance")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        driver_tracking_distance_meters: 15,
        driver_tracking_interval_seconds: 4,
        off_route_alert_cooldown_seconds: 180,
        off_route_threshold_meters: 250,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });
});
