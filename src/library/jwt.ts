import { randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { appEnv } from "../config/env";
import type { AppRole } from "../database/schema";
import type { AuthenticatedUser } from "../modules/auth/auth.types";

type SignTokenPayload = {
  userId: string;
  email: string;
  role: AppRole;
};

export function signAccessToken(payload: SignTokenPayload) {
  const options: SignOptions = {
    expiresIn: appEnv.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    jwtid: randomUUID(),
  };

  return jwt.sign(payload, appEnv.JWT_SECRET, options);
}

function isAuthenticatedUser(payload: unknown): payload is AuthenticatedUser {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.userId === "string" &&
    typeof p.email === "string" &&
    typeof p.role === "string" &&
    typeof p.jti === "string" &&
    typeof p.exp === "number"
  );
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  const decoded = jwt.verify(token, appEnv.JWT_SECRET, { algorithms: ["HS256"] });
  if (!isAuthenticatedUser(decoded)) {
    throw new Error("Invalid token payload shape");
  }
  return decoded;
}
