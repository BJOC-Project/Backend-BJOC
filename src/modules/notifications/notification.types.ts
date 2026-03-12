export type NotificationRole =
  | "admin"
  | "operator"
  | "driver"
  | "passenger";

export type NotificationType =
  | "trip"
  | "vehicle"
  | "driver"
  | "maintenance"
  | "route"
  | "system"
  | "emergency"
  | "message";

export type NotificationSeverity =
  | "info"
  | "success"
  | "warning"
  | "critical";

export interface CreateNotificationDTO {
  title: string;
  message: string;

  type: NotificationType;

  severity?: NotificationSeverity;

  target_role: NotificationRole;

  entity_id?: string | null;
  entity_type?: string | null;

  metadata?: Record<string, any>;
}