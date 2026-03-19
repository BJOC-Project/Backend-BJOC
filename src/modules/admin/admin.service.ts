import { supabase } from "../../config/supabase"
import {
  DashboardSummary,
  VehicleStatus,
  DriverPerformance
} from "./admin.types"



/* ---------------- DASHBOARD SUMMARY ---------------- */

export async function getDashboardSummary(filter?: string): Promise<DashboardSummary> {

  const fromDate = getFilterDate(filter)

  const { count: trips } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .gte("created_at", fromDate)

  const { count: passengers } = await supabase
    .from("passenger_users")
    .select("*", { count: "exact", head: true })
    .gte("created_at", fromDate)

  const { count: waitingStops } = await supabase
    .from("waiting_passengers")
    .select("*", { count: "exact", head: true })
    .gte("created_at", fromDate)

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



/* ---------------- VEHICLE STATUS ---------------- */

export async function getVehicleStatus(): Promise<VehicleStatus[]> {

  const { data, error } = await supabase
    .from("vehicles")
    .select("status")

  if (error) {
    console.error("Vehicle status error:", error)
    return []
  }

  const counts: Record<string, number> = {}

  data?.forEach(v => {
    counts[v.status] = (counts[v.status] || 0) + 1
  })

  return Object.entries(counts).map(([status, count]) => ({
    status,
    count
  }))
}



/* ---------------- DRIVER PERFORMANCE ---------------- */

export async function getDriverPerformance(filter?: string): Promise<DriverPerformance[]> {

  const fromDate = getFilterDate(filter)

  const { data, error } = await supabase
    .from("driver_ratings")
    .select(`
      driver_id,
      rating,
      created_at,
      drivers (
        first_name,
        last_name
      )
    `)
    .gte("created_at", fromDate)

  if (error) {
    console.error("Driver performance error:", error)
    return []
  }

  const stats: Record<string, {
    name: string
    total: number
    count: number
  }> = {}

  data?.forEach((r: any) => {

    const name = `${r.drivers?.first_name ?? ""} ${r.drivers?.last_name ?? ""}`

    if (!stats[r.driver_id]) {
      stats[r.driver_id] = {
        name,
        total: 0,
        count: 0
      }
    }

    stats[r.driver_id].total += r.rating
    stats[r.driver_id].count += 1

  })

  return Object.values(stats).map(d => ({
    driver: d.name.trim(),
    rating: d.count ? d.total / d.count : 0,
    trips: d.count
  }))

}



/* ---------------- ALERTS ---------------- */

export async function getLatestAlerts() {

  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) {
    console.error("Alerts error:", error)
    return []
  }

  return data ?? []

}



/* ---------------- NOTIFICATIONS ---------------- */

export async function getLatestNotifications() {

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) {
    console.error("Notifications error:", error)
    return []
  }

  return data ?? []

}



/* ---------------- APP RATINGS ---------------- */

export async function getAppRatings(filter?: string) {

  const fromDate = getFilterDate(filter)

  const { data, error } = await supabase
    .from("app_ratings")
    .select("rating, created_at")
    .gte("created_at", fromDate)

  if (error) {
    console.error("App ratings error:", error)
    return { average: 0, total: 0 }
  }

  if (!data || data.length === 0) {
    return { average: 0, total: 0 }
  }

  const total = data.length

  const avg =
    data.reduce((sum, r) => sum + r.rating, 0) / total

  return {
    average: avg,
    total
  }

}



/* ---------------- SUGGESTIONS ---------------- */

export async function getSuggestions(filter?: string) {

  const fromDate = getFilterDate(filter)

  const { data, error } = await supabase
    .from("suggestions")
    .select("*")
    .gte("created_at", fromDate)
    .order("created_at", { ascending: false })
    .limit(10)

  if (error) {
    console.error("Suggestions error:", error)
    return []
  }

  return data ?? []

}



/* ---------------- GET ROUTES ---------------- */

export async function getRoutes() {

  const { data, error } = await supabase
    .from("routes")
    .select("id, route_name, start_location, end_location")
    .order("start_location")

  if (error) {
    console.error("Routes fetch error:", error)
    return []
  }

  return data ?? []

}



/* ---------------- PASSENGER WAITING TREND ---------------- */

export async function getWaitingStops(routeId: string, filter?: string) {

  const fromDate = getFilterDate(filter)

  /* GET STOPS */

  const { data: stops, error: stopError } = await supabase
    .from("stops")
    .select("id, stop_name")
    .eq("route_id", routeId)
    .eq("is_active", true)
    .order("stop_order", { ascending: true })

  if (stopError) {
    console.error("Stops fetch error:", stopError)
    return { stops: [], hours: [], matrix: {} }
  }

  const stopNames = stops?.map(s => s.stop_name) ?? []



  /* GET WAITING PASSENGERS WITH STOP JOIN */

  const { data, error } = await supabase
    .from("waiting_passengers")
    .select(`
      stop_id,
      passenger_count,
      created_at,
      stops (
        stop_name
      )
    `)
    .eq("route_id", routeId)
    .gte("created_at", fromDate)

  if (error) {
    console.error("Waiting passengers error:", error)
  }



  const hours = [
    "06:00","07:00","08:00","09:00",
    "10:00","11:00","12:00","13:00",
    "14:00","15:00","16:00","17:00",
    "18:00","19:00","20:00"
  ]



  const matrix: Record<string, Record<string, number>> = {}

  hours.forEach(hour => {

    matrix[hour] = {}

    stopNames.forEach(stop => {
      matrix[hour][stop] = 0
    })

  })



  data?.forEach((row: any) => {

    const hour =
      new Date(row.created_at)
        .toISOString()
        .substring(11, 13) + ":00"

    const stopName = row.stops?.stop_name

    if (matrix[hour] && matrix[hour][stopName] !== undefined) {

      matrix[hour][stopName] += row.passenger_count ?? 1

    }

  })



  return {
    stops: stopNames,
    hours,
    matrix
  }

}



/* ---------------- DATE FILTER ---------------- */

function getFilterDate(filter?: string) {

  const date = new Date()

  if (filter === "today") {
    date.setHours(0, 0, 0, 0)
  }

  else if (filter === "week") {
    date.setDate(date.getDate() - 7)
  }

  else if (filter === "month") {
    date.setMonth(date.getMonth() - 1)
  }

  else {
    date.setHours(0, 0, 0, 0)
  }

  return date.toISOString()

}