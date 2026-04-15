import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors/app-error";
import { verifyAccessToken } from "../library/jwt";
import { isBlocklisted } from "../library/token-blocklist";

export function authenticateRequest(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing bearer token"));
    return;
  }

  const token = authorizationHeader.replace("Bearer ", "").trim();

  try {
    const authUser = verifyAccessToken(token);

    if (isBlocklisted(authUser.jti)) {
      next(new UnauthorizedError("Token has been revoked"));
      return;
    }

    req.authUser = authUser;
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}
