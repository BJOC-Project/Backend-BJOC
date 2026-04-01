import type { Request, Response } from "express";
import { sendSuccess } from "../../library/response";
import { healthGetStatus } from "./health.service";

export function healthCheck(
  _req: Request,
  res: Response,
) {
  sendSuccess(res, healthGetStatus(), "Service is healthy");
}
