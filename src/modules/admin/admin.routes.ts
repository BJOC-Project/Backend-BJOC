import { Router } from "express"
import {
  getDashboardSummary,
  getVehicleStatus,
  getRoutes,
  getWaitingStops,
  getDriverPerformance,
  getLatestAlerts,
  getLatestNotifications,
  getAppRatings,
  getSuggestions
} from "./admin.controller"

const router = Router()



/* ---------------- DASHBOARD ---------------- */

router.get("/dashboard-summary", getDashboardSummary)

router.get("/vehicle-status", getVehicleStatus)



/* ---------------- ROUTES ---------------- */

router.get("/routes", getRoutes)



/* ---------------- PASSENGER WAITING TREND ---------------- */

router.get("/waiting-stops", getWaitingStops)



/* ---------------- DRIVER PERFORMANCE ---------------- */

router.get("/driver-performance", getDriverPerformance)



/* ---------------- ALERTS & NOTIFICATIONS ---------------- */

router.get("/alerts", getLatestAlerts)

router.get("/notifications", getLatestNotifications)



/* ---------------- FEEDBACK ---------------- */

router.get("/app-ratings", getAppRatings)

router.get("/suggestions", getSuggestions)



export default router