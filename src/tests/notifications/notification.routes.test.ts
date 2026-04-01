import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../app";
import { createTestAccessToken } from "../helpers/auth";

describe("notification routes", () => {
  it("returns 401 for notifications without token", async () => {
    const response = await request(app).get("/api/notifications");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("returns 400 for invalid pagination query", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .get("/api/notifications?page=0&limit=200")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("returns 400 for invalid notification type filter", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .get("/api/notifications?type=unknown")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });
});
