import { Router } from "express";
import {
  getTripHistory,
  getPassengerVolume,
  getPeakHours,
  getPassengerTrend,
  getDriverPerformance
} from "./reports.controller";

const router = Router();
router.get("/trips", getTripHistory);
router.get("/passenger-volume", getPassengerVolume);

router.get("/peak-hours", getPeakHours);

router.get("/daily-trend", getPassengerTrend);

router.get("/drivers", getDriverPerformance);

export default router;