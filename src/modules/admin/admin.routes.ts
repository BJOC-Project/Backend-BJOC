import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  adminAlerts,
  adminAppRatings,
  adminDriverPerformance,
  adminGetDashboard,
  adminMaintenanceSettings,
  adminGetProfile,
  adminGetUsers,
  adminLiveMap,
  adminNotifications,
  adminRoutes,
  adminSuggestions,
  adminUpdateSettings,
  adminVehicleStatus,
  adminWaitingStops,
} from "./admin.controller";
import {
  dashboardFilterQuerySchema,
  systemMaintenanceSettingsBodySchema,
  waitingStopsQuerySchema,
} from "./admin.validation";

const router = Router();

router.use(authenticateRequest, authorizeRoles("admin"));
router.get("/profile", adminGetProfile);
router.get("/users", adminGetUsers);
router.get("/dashboard-summary", validate({ query: dashboardFilterQuerySchema }), adminGetDashboard);
router.get("/vehicle-status", adminVehicleStatus);
router.get("/routes", adminRoutes);
router.get("/waiting-stops", validate({ query: waitingStopsQuerySchema }), adminWaitingStops);
router.get("/driver-performance", validate({ query: dashboardFilterQuerySchema }), adminDriverPerformance);
router.get("/alerts", adminAlerts);
router.get("/notifications", adminNotifications);
router.get("/app-ratings", validate({ query: dashboardFilterQuerySchema }), adminAppRatings);
router.get("/suggestions", validate({ query: dashboardFilterQuerySchema }), adminSuggestions);
router.get("/live-map", adminLiveMap);
router.get("/settings/maintenance", adminMaintenanceSettings);
router.patch("/settings/maintenance", validate({ body: systemMaintenanceSettingsBodySchema }), adminUpdateSettings);

export default router;
