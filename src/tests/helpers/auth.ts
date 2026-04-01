import { signAccessToken } from "../../library/jwt";
import type { AppRole } from "../../database/schema";

export function createTestAccessToken(role: AppRole) {
  return signAccessToken({
    email: `${role}@example.com`,
    role,
    userId: "11111111-1111-1111-1111-111111111111",
  });
}
