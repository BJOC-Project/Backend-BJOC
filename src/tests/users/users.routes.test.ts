import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../app";
import { createTestAccessToken } from "../helpers/auth";

describe("user routes", () => {
  it("returns 401 when bearer token is missing", async () => {
    const response = await request(app)
      .get("/api/users/11111111-1111-1111-1111-111111111111");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Missing bearer token");
  });

  it("returns 403 when a non-admin tries to create a user", async () => {
    const driverToken = createTestAccessToken("driver");

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        email: "new.driver@example.com",
        first_name: "New",
        last_name: "Driver",
        license_number: "DL-100",
        password: "password123",
        role: "driver",
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("You do not have access to this resource");
  });

  it("returns 400 when admin creates a driver without a license number", async () => {
    const adminToken = createTestAccessToken("admin");

    const response = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: "new.driver@example.com",
        first_name: "New",
        last_name: "Driver",
        password: "password123",
        role: "driver",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });

  it("returns 400 when admin requests a user with an invalid id", async () => {
    const adminToken = createTestAccessToken("admin");

    const response = await request(app)
      .get("/api/users/not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
  });
});
