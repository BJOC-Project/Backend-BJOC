import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { staffViewProfile } from "./staff.service";

export const staffGetProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await staffViewProfile(req.authUser!.userId);
  sendSuccess(res, result, "Staff profile loaded");
});
