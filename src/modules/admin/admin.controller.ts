import { Request, Response } from "express"
import * as service from "./admin.service"



/* ---------------- DASHBOARD SUMMARY ---------------- */

export async function getDashboardSummary(req: Request, res: Response) {

  try {

    const filter = (req.query.filter as string) || "today"

    const data = await service.getDashboardSummary(filter)

    res.json(data)

  } catch (err) {

    console.error("DashboardSummary error:", err)

    res.status(500).json({
      message: "Failed to fetch dashboard summary"
    })

  }

}



/* ---------------- VEHICLE STATUS ---------------- */

export async function getVehicleStatus(req: Request, res: Response) {

  try {

    const data = await service.getVehicleStatus()

    res.json(data)

  } catch (err) {

    console.error("VehicleStatus error:", err)

    res.status(500).json({
      message: "Failed to fetch vehicle status"
    })

  }

}



/* ---------------- ROUTES ---------------- */

export async function getRoutes(req: Request, res: Response) {

  try {

    const data = await service.getRoutes()

    res.json(data)

  } catch (err) {

    console.error("Routes error:", err)

    res.status(500).json({
      message: "Failed to fetch routes"
    })

  }

}



/* ---------------- PASSENGER WAITING TREND ---------------- */

export async function getWaitingStops(req: Request, res: Response) {

  try {

    const routeId = req.query.routeId as string
    const filter = (req.query.filter as string) || "today"

    if (!routeId) {

      return res.status(400).json({
        message: "routeId is required"
      })

    }

    const data = await service.getWaitingStops(routeId, filter)

    res.json(data)

  } catch (err) {

    console.error("WaitingStops error:", err)

    res.status(500).json({
      message: "Failed to fetch passenger waiting trend"
    })

  }

}



/* ---------------- DRIVER PERFORMANCE ---------------- */

export async function getDriverPerformance(req: Request, res: Response) {

  try {

    const filter = (req.query.filter as string) || "today"

    const data = await service.getDriverPerformance(filter)

    res.json(data)

  } catch (err) {

    console.error("DriverPerformance error:", err)

    res.status(500).json({
      message: "Failed to fetch driver performance"
    })

  }

}



/* ---------------- ALERTS ---------------- */

export async function getLatestAlerts(req: Request, res: Response) {

  try {

    const data = await service.getLatestAlerts()

    res.json(data)

  } catch (err) {

    console.error("LatestAlerts error:", err)

    res.status(500).json({
      message: "Failed to fetch alerts"
    })

  }

}



/* ---------------- NOTIFICATIONS ---------------- */

export async function getLatestNotifications(req: Request, res: Response) {

  try {

    const data = await service.getLatestNotifications()

    res.json(data)

  } catch (err) {

    console.error("LatestNotifications error:", err)

    res.status(500).json({
      message: "Failed to fetch notifications"
    })

  }

}



/* ---------------- APP RATINGS ---------------- */

export async function getAppRatings(req: Request, res: Response) {

  try {

    const filter = (req.query.filter as string) || "today"

    const data = await service.getAppRatings(filter)

    res.json(data)

  } catch (err) {

    console.error("AppRatings error:", err)

    res.status(500).json({
      message: "Failed to fetch app ratings"
    })

  }

}



/* ---------------- SUGGESTIONS ---------------- */

export async function getSuggestions(req: Request, res: Response) {

  try {

    const filter = (req.query.filter as string) || "today"

    const data = await service.getSuggestions(filter)

    res.json(data)

  } catch (err) {

    console.error("Suggestions error:", err)

    res.status(500).json({
      message: "Failed to fetch suggestions"
    })

  }

}