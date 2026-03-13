import { Router } from "express"
import {
  getDashboardSummary,
  getVehicleStatus,
  getWaitingStops,
  getDriverPerformance,
  getLatestAlerts,
  getLatestNotifications
} from "./admin.controller"

const router = Router()

router.get("/dashboard-summary", getDashboardSummary)
router.get("/vehicle-status", getVehicleStatus)
router.get("/waiting-stops", getWaitingStops)
router.get("/driver-performance", getDriverPerformance)
router.get("/latest-alerts", getLatestAlerts)
router.get("/latest-notifications", getLatestNotifications)

export default router