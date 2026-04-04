import {
  operationsGetAdminAlerts,
  operationsGetAdminDashboardSummary,
  operationsGetAdminLiveMap,
  operationsGetAdminNotifications,
  operationsGetAdminRoutes,
  operationsGetAdminVehicleStatus,
  operationsGetDriverPerformance,
  operationsGetPassengerWaitingStops,
} from "../operations/operations.service";
import { feedbackGetAppRatings, feedbackGetSuggestions } from "../feedback/feedback.service";
import {
  systemSettingsGetMaintenanceSettings,
  systemSettingsUpdateMaintenanceSettings,
} from "../system-settings/system-settings.service";
import type { SystemMaintenanceSettingsBody } from "../system-settings/system-settings.validation";
import { usersFindUserProfileById, usersListUsers } from "../users/users.service";
import type { AdminUserListQuery } from "./admin.types";

export function adminListUsers(query: AdminUserListQuery) {
  return usersListUsers(query);
}

export function adminViewProfile(userId: string) {
  return usersFindUserProfileById(userId);
}

export function adminGetDashboardSummary(filter?: string) {
  return operationsGetAdminDashboardSummary(filter);
}

export function adminGetVehicleStatus() {
  return operationsGetAdminVehicleStatus();
}

export function adminGetRoutes() {
  return operationsGetAdminRoutes();
}

export function adminGetWaitingStops(
  routeId: string,
  filter?: string,
) {
  return operationsGetPassengerWaitingStops(routeId, filter);
}

export function adminGetDriverPerformance(filter?: string) {
  return operationsGetDriverPerformance(filter);
}

export function adminGetAlerts() {
  return operationsGetAdminAlerts();
}

export function adminGetNotifications(userId: string) {
  return operationsGetAdminNotifications(userId);
}

export function adminGetAppRatings() {
  return feedbackGetAppRatings();
}

export function adminGetAppRatingsByFilter(filter?: string) {
  return feedbackGetAppRatings(filter);
}

export function adminGetSuggestions(filter?: string) {
  return feedbackGetSuggestions(filter);
}

export function adminGetLiveMap() {
  return operationsGetAdminLiveMap();
}

export function adminGetMaintenanceSettings() {
  return systemSettingsGetMaintenanceSettings();
}

export function adminUpdateMaintenanceSettings(
  input: SystemMaintenanceSettingsBody,
  actorUserId?: string,
) {
  return systemSettingsUpdateMaintenanceSettings(input, actorUserId);
}
