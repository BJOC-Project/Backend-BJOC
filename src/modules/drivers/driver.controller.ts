import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import { driverViewProfile } from "./driver.service";

export const driverGetProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await driverViewProfile(req.authUser!.userId);
  sendSuccess(res, result, "Driver profile loaded");
});
