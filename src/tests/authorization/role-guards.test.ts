import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../app";
import { createTestAccessToken } from "../helpers/auth";

describe("role guards", () => {
  it("returns 403 when driver token hits passenger-only endpoint", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .get("/api/passengers/profile")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("You do not have access to this resource");
  });

  it("returns 403 when admin token hits staff-only endpoint", async () => {
    const adminToken = createTestAccessToken("admin");

    const response = await request(app)
      .get("/api/staff/profile")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("You do not have access to this resource");
  });
});
