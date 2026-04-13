import type { AppRole } from "../../database/schema";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: AppRole;
  /** JWT ID — unique per token, used for blocklist revocation */
  jti: string;
  /** JWT expiry as Unix seconds (set by jsonwebtoken) */
  exp: number;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: AppRole;
    status: string;
  };
}
