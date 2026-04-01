import { operationsListActivityLogs } from "../operations/operations.service";
import type { ActivityLogsQuery } from "./activityLogs.validation";

export function getActivityLogsService(query: ActivityLogsQuery) {
  return operationsListActivityLogs(query);
}
