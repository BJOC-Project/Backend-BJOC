import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../app";
import { createTestAccessToken } from "../helpers/auth";

describe("passenger route planner routes", () => {
  it("returns 401 when passenger route options are requested without a token", async () => {
    const response = await request(app).get("/api/routes/options");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("returns 403 when a driver requests passenger route options", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .get("/api/routes/options")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("returns 400 for an invalid passenger route segment query", async () => {
    const passengerToken = createTestAccessToken("passenger");

    const response = await request(app)
      .get("/api/routes/segment")
      .query({
        routeId: "not-a-uuid",
        pickupStopId: "also-not-a-uuid",
      })
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("returns 400 for an invalid passenger route booking payload", async () => {
    const passengerToken = createTestAccessToken("passenger");

    const response = await request(app)
      .post("/api/routes/book")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        routeId: "not-a-uuid",
        pickupStopId: "still-not-a-uuid",
        dropoffStopId: "not-valid-either",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });
});
