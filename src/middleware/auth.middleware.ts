import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors/app-error";
import { verifyAccessToken } from "../library/jwt";

export function authenticateRequest(req: Request, _res: Response, next: NextFunction) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing bearer token"));
    return;
  }

  const token = authorizationHeader.replace("Bearer ", "").trim();

  try {
    req.authUser = verifyAccessToken(token);
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}
