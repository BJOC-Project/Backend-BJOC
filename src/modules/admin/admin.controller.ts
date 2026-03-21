import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { adminListUsers, adminViewProfile } from "./admin.service";

export const adminGetUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminListUsers(req.query);
  sendSuccess(res, result.items, "Users loaded", 200, result.meta);
});

export const adminGetProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminViewProfile(req.authUser!.userId);
  sendSuccess(res, result, "Admin profile loaded");
});
