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

export function verifyAccessToken(token: string) {
  return jwt.verify(token, appEnv.JWT_SECRET, {
    algorithms: ["HS256"],
  }) as AuthenticatedUser;
}
