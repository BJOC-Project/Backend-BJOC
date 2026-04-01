import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import {
  usersCreateUser,
  usersDeleteUser,
  usersFindUserProfileById,
  usersSuspendUser,
  usersUnsuspendUser,
  usersUpdateUser,
} from "./users.service";
import type {
  CreateUserBody,
  SuspendUserBody,
  UpdateUserBody,
  UserIdParams,
} from "./users.validation";

export const userGetById = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as UserIdParams;
  const result = await usersFindUserProfileById(params.userId);
  sendSuccess(res, result, "User loaded");
});

export const userCreate = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as CreateUserBody;
  const result = await usersCreateUser(body);
  sendSuccess(res, result, "User created", 201);
});

export const userUpdate = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as UpdateUserBody;
  const params = req.params as unknown as UserIdParams;
  const result = await usersUpdateUser(params.userId, body);
  sendSuccess(res, result, "User updated");
});

export const userDelete = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as UserIdParams;
  const result = await usersDeleteUser(params.userId, req.authUser?.userId);
  sendSuccess(res, result, "User deleted");
});

export const userSuspend = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const body = req.body as SuspendUserBody;
  const params = req.params as unknown as UserIdParams;
  const result = await usersSuspendUser(params.userId, body, req.authUser?.userId);
  sendSuccess(res, result, "User suspended");
});

export const userUnsuspend = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as UserIdParams;
  const result = await usersUnsuspendUser(params.userId, req.authUser?.userId);
  sendSuccess(res, result, "User unsuspended");
});
