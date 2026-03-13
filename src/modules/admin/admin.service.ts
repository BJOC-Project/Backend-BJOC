import { supabase } from "../../config/supabase"
import {
  DashboardSummary,
  VehicleStatus,
  WaitingStop,
  DriverPerformance
} from "./admin.types"


export async function getDashboardSummary(): Promise<DashboardSummary> {

  const { count: trips } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })

  const { count: passengers } = await supabase
    .from("passenger_users")
    .select("*", { count: "exact", head: true })

  const { count: waitingStops } = await supabase
    .from("waiting_passengers")
    .select("*", { count: "exact", head: true })

  const { count: activeVehicles } = await supabase
    .from("vehicles")
    .select("*", { count: "exact", head: true })
    .eq("status", "on_trip")

  return {
    trips: trips ?? 0,
    passengers: passengers ?? 0,
    waitingStops: waitingStops ?? 0,
    activeVehicles: activeVehicles ?? 0
  }
}


export async function getVehicleStatus(): Promise<VehicleStatus[]> {

  const { data } = await supabase
    .from("vehicles")
    .select("status")

  const counts: Record<string, number> = {}

  data?.forEach(v => {
    counts[v.status] = (counts[v.status] || 0) + 1
  })

  return Object.entries(counts).map(([status, count]) => ({
    status,
    count
  }))
}


export async function getWaitingStops(): Promise<WaitingStop[]> {

  const { data } = await supabase
    .from("waiting_passengers")
    .select("stop_name")

  const counts: Record<string, number> = {}

  data?.forEach(stop => {
    counts[stop.stop_name] = (counts[stop.stop_name] || 0) + 1
  })

  return Object.entries(counts).map(([stop, count]) => ({
    stop,
    count
  }))
}


export async function getDriverPerformance(): Promise<DriverPerformance[]> {

  const { data } = await supabase
    .from("driver_ratings")
    .select("driver_id, rating")

  const stats: Record<string, { total: number, count: number }> = {}

  data?.forEach(r => {

    if (!stats[r.driver_id]) {
      stats[r.driver_id] = { total: 0, count: 0 }
    }

    stats[r.driver_id].total += r.rating
    stats[r.driver_id].count += 1

  })

  return Object.entries(stats).map(([driver, val]) => ({
    driver,
    rating: val.total / val.count
  }))
}


export async function getLatestAlerts() {

  const { data } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  return data ?? []
}


export async function getLatestNotifications() {

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  return data ?? []
}