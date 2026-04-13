import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../library/response";
import { healthGetStatus } from "./health.service";

export async function healthCheck(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const status = await healthGetStatus();
    sendSuccess(res, status, "Service is healthy");
  } catch (error) {
    next(error);
  }
}
