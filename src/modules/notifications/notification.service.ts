import {
  operationsListNotifications,
  operationsMarkAllNotificationsRead,
  operationsMarkNotificationRead,
} from "../operations/operations.service";
import type { NotificationListQuery } from "./notification.validation";

export function getNotifications(
  userId: string,
  query: NotificationListQuery,
) {
  return operationsListNotifications(userId, query);
}

export function markNotificationRead(
  notificationId: string,
  userId: string,
) {
  return operationsMarkNotificationRead(notificationId, userId);
}

export function markAllNotificationsRead(userId: string) {
  return operationsMarkAllNotificationsRead(userId);
}
