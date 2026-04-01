import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  reportGetDailyTrend,
  reportGetDrivers,
  reportGetPassengerVolume,
  reportGetPeakHours,
  reportGetTrips,
} from "./reports.controller";
import { reportQuerySchema } from "./reports.validation";

const router = Router();

router.use(authenticateRequest, authorizeRoles("admin"));
router.get("/trips", validate({ query: reportQuerySchema }), reportGetTrips);
router.get("/passenger-volume", validate({ query: reportQuerySchema }), reportGetPassengerVolume);
router.get("/peak-hours", validate({ query: reportQuerySchema }), reportGetPeakHours);
router.get("/daily-trend", validate({ query: reportQuerySchema }), reportGetDailyTrend);
router.get("/drivers", validate({ query: reportQuerySchema }), reportGetDrivers);

export default router;
