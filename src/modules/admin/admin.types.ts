export type DashboardSummary = {
  trips: number
  passengers: number
  waitingStops: number
  activeVehicles: number
}

export type VehicleStatus = {
  status: string
  count: number
}

export type WaitingStop = {
  stop: string
  count: number
}

export type DriverPerformance = {
  driver: string
  rating: number
  trips: number
}

export type AlertItem = {
  id: string
  title: string
  message: string
  severity: string
  created_at: string
}

export type NotificationItem = {
  id: string
  title: string
  message: string
  created_at: string
}