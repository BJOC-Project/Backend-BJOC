import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../app";

describe("auth routes", () => {
  it("returns 400 for invalid register payload", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      password: "123",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("returns 400 for invalid login payload", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "bad",
      password: "123",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("returns 401 for me endpoint without token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
