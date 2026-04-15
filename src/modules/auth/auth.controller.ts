import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { addToBlocklist } from "../../library/token-blocklist";
import { sendSuccess } from "../../library/response";
import { authGetCurrentUser, authLogin, authRegisterPassenger } from "./auth.service";

export const authRegister = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await authRegisterPassenger(req.body);
  sendSuccess(res, result, "Registration successful", 201);
});

export const authLoginUser = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await authLogin(req.body);
  sendSuccess(res, result, "Login successful");
});

export const authGetMe = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await authGetCurrentUser(req.authUser!.userId);
  sendSuccess(res, result, "Authenticated user loaded");
});

export const authLogout = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const { jti, exp } = req.authUser!;
  addToBlocklist(jti, exp);
  sendSuccess(res, null, "Logged out successfully");
});
