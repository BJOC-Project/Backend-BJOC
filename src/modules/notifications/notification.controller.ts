import type { Request, Response } from "express";
import { asyncHandler } from "../../library/async-handler";
import { sendSuccess } from "../../library/response";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.service";
import type { NotificationIdParams, NotificationListQuery } from "./notification.validation";

export const fetchNotifications = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const query = req.query as unknown as NotificationListQuery;
  const result = await getNotifications(req.authUser!.userId, query);
  sendSuccess(res, result.items, "Notifications loaded", 200, result.meta);
});

export const readNotification = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const params = req.params as unknown as NotificationIdParams;
  const result = await markNotificationRead(params.id, req.authUser!.userId);
  sendSuccess(res, result, "Notification marked as read");
});

export const readAllNotifications = asyncHandler(async (
  req: Request,
  res: Response,
) => {
  const result = await markAllNotificationsRead(req.authUser!.userId);
  sendSuccess(res, result, "All notifications marked as read");
});
