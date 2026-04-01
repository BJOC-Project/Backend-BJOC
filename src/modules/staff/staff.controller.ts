import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import { staffViewProfile } from "./staff.service";

export const staffGetProfile = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await staffViewProfile(req.authUser!.userId);
  sendSuccess(res, result, "Staff profile loaded");
});
