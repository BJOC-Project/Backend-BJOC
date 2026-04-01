import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import { getActivityLogsService } from "./activityLogs.service";
import type { ActivityLogsQuery } from "./activityLogs.validation";

export const getActivityLogs = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as ActivityLogsQuery;
  const result = await getActivityLogsService(query);
  sendSuccess(res, result, "Activity logs loaded");
});
