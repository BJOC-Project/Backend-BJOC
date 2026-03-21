import type { NextFunction, Request, Response } from "express";
import type { AppRole } from "../database/schema";
import { ForbiddenError, UnauthorizedError } from "../errors/app-error";

export function authorizeRoles(...allowedRoles: AppRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authUser = req.authUser;

    if (!authUser) {
      next(new UnauthorizedError("Authentication is required"));
      return;
    }

    if (!allowedRoles.includes(authUser.role)) {
      next(new ForbiddenError("You do not have access to this resource"));
      return;
    }

    next();
  };
}
