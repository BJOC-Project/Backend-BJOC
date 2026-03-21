import jwt, { type SignOptions } from "jsonwebtoken";
import { appEnv } from "../config/env";
import type { AuthenticatedUser } from "../modules/auth/auth.types";

export function signAccessToken(payload: AuthenticatedUser) {
  const options: SignOptions = {
    expiresIn: appEnv.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, appEnv.JWT_SECRET, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, appEnv.JWT_SECRET) as AuthenticatedUser;
}
