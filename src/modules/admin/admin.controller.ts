import { Request, Response } from "express"
import * as service from "./admin.service"


export async function getDashboardSummary(req: Request, res: Response) {
  const data = await service.getDashboardSummary()
  res.json(data)
}

export async function getVehicleStatus(req: Request, res: Response) {
  const data = await service.getVehicleStatus()
  res.json(data)
}

export async function getWaitingStops(req: Request, res: Response) {
  const data = await service.getWaitingStops()
  res.json(data)
}

export async function getDriverPerformance(req: Request, res: Response) {
  const data = await service.getDriverPerformance()
  res.json(data)
}

export async function getLatestAlerts(req: Request, res: Response) {
  const data = await service.getLatestAlerts()
  res.json(data)
}

export async function getLatestNotifications(req: Request, res: Response) {
  const data = await service.getLatestNotifications()
  res.json(data)
}