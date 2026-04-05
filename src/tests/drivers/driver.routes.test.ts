import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../app";
import { createTestAccessToken } from "../helpers/auth";

describe("driver routes", () => {
  it("returns 403 when a passenger accesses driver active trips", async () => {
    const passengerToken = createTestAccessToken("passenger");

    const response = await request(app)
      .get("/api/drivers/trips/active")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("returns 403 when a passenger accesses driver management endpoint", async () => {
    const passengerToken = createTestAccessToken("passenger");

    const response = await request(app)
      .get("/api/drivers/trips/11111111-1111-1111-1111-111111111111/management")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("returns 403 when a passenger accesses driver tracking settings", async () => {
    const passengerToken = createTestAccessToken("passenger");

    const response = await request(app)
      .get("/api/drivers/tracking-settings")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("returns 400 when emergency reason text is missing for 'other'", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .patch("/api/drivers/trips/11111111-1111-1111-1111-111111111111/emergency")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        client_action_id: "client-action-1",
        passenger_count: 8,
        reason_type: "other",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("returns 400 when emergency passenger count is negative", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .patch("/api/drivers/trips/11111111-1111-1111-1111-111111111111/emergency")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        client_action_id: "client-action-2",
        passenger_count: -3,
        reason_type: "vehicle_problem",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("returns 400 when driver trip detail id is invalid", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .get("/api/drivers/trips/not-a-uuid")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("returns 403 when a passenger cancels a driver trip", async () => {
    const passengerToken = createTestAccessToken("passenger");

    const response = await request(app)
      .patch("/api/drivers/trips/11111111-1111-1111-1111-111111111111/cancel")
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("returns 400 when driver cancel trip id is invalid", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .patch("/api/drivers/trips/not-a-uuid/cancel")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("returns 400 when occupied seats are negative", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .patch("/api/drivers/trips/11111111-1111-1111-1111-111111111111/passengers")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        occupied_seats: -1,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });
});
