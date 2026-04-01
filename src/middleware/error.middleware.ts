import type { NextFunction, Request, Response } from "express";
import { appEnv } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../errors/app-error";

export function errorMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const appError =
    error instanceof AppError
      ? error
      : new AppError("Something went wrong", 500, "INTERNAL_SERVER_ERROR");

  logger.error(
    {
      method: req.method,
      path: req.originalUrl,
      statusCode: appError.statusCode,
      userId: req.authUser?.userId,
      role: req.authUser?.role,
      error,
    },
    appError.message,
  );

  res.status(appError.statusCode).json({
    success: false,
    message: appError.message,
    code: appError.code,
    ...(appError.details ? { details: appError.details } : {}),
    ...(appEnv.NODE_ENV !== "production" && !(error instanceof AppError)
      ? { stack: error instanceof Error ? error.stack : undefined }
      : {}),
  });
}
