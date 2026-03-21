import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import { passengerViewProfile } from "./passenger.service";

export const passengerGetProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await passengerViewProfile(req.authUser!.userId);
  sendSuccess(res, result, "Passenger profile loaded");
});
