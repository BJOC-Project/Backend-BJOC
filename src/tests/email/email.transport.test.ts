import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({
  appEnv: {
    APP_NAME: "BJOC Backend",
    EMAIL_FROM: undefined,
    EMAIL_PASS: "app-password",
    EMAIL_SERVICE: undefined,
    EMAIL_USER: "tester@gmail.com",
    SMTP_HOST: undefined,
    SMTP_PORT: undefined,
    SMTP_SECURE: undefined,
  },
}));

describe("email transport config", () => {
  it("derives Gmail SMTP settings from the auth email domain", async () => {
    const { describeEmailTransportForLogs } = await import("../../library/email");

    expect(describeEmailTransportForLogs()).toEqual({
      authUser: "tester@gmail.com",
      domain: "gmail.com",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      transport: "derived-provider",
    });
  });
});
