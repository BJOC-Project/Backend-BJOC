import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../app";
import { createTestAccessToken } from "../helpers/auth";

describe("trip lifecycle routes", () => {
  it("returns 401 for trip end without token", async () => {
    const response = await request(app)
      .patch("/api/trips/11111111-1111-1111-1111-111111111111/end")
      .send({
        passenger_count: 10,
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("returns 400 for invalid trip end payload with driver token", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .patch("/api/trips/11111111-1111-1111-1111-111111111111/end")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        passenger_count: -1,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("returns 400 for invalid trip id on start", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .patch("/api/trips/not-a-uuid/start")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });
});
