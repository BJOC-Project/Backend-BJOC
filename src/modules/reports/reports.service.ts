import { supabase } from "../../config/supabase";

export type GetTripHistoryParams = {
  startDate?: string;
  endDate?: string;
  search?: string;
};

export type TripHistory = {
  id: string;
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: string | null;
  route_name: string | null;
  driver_name: string | null;
  plate_number: string | null;
};

/**
 * TRIP HISTORY
 */
export async function getTripHistoryService(
  params: GetTripHistoryParams
): Promise<TripHistory[]> {

  const { startDate, endDate, search } = params;

  let query = supabase
    .from("trips")
    .select(`
      id,
      scheduled_departure_time,
      start_time,
      end_time,
      status,
      trip_date,
      routes (
        route_name
      ),
      vehicles (
        plate_number,
        drivers (
          first_name,
          last_name
        )
      )
    `)
    .order("scheduled_departure_time", { ascending: false });

  if (startDate) query = query.gte("trip_date", startDate);
  if (endDate) query = query.lte("trip_date", endDate);

  const { data, error } = await query;

  if (error) throw error;

  if (!data) return [];

  let trips: TripHistory[] = data.map((trip: any) => ({
    id: trip.id,

    scheduled_start: trip.scheduled_departure_time,
    actual_start: trip.start_time,
    actual_end: trip.end_time,

    status: trip.status,

    route_name: trip.routes?.route_name ?? null,

    driver_name: trip.vehicles?.drivers
      ? `${trip.vehicles.drivers.first_name} ${trip.vehicles.drivers.last_name}`
      : null,

    plate_number: trip.vehicles?.plate_number ?? null
  }));

  if (search) {

    const keyword = search.toLowerCase();

    trips = trips.filter((trip) =>
      trip.driver_name?.toLowerCase().includes(keyword) ||
      trip.plate_number?.toLowerCase().includes(keyword) ||
      trip.route_name?.toLowerCase().includes(keyword)
    );

  }

  return trips;
}


/**
 * PASSENGER VOLUME PER ROUTE (Analytics)
 */
export async function getPassengerVolumeByRoute({
  startDate,
  endDate
}: any) {

  let query = supabase
    .from("passenger_logs")
    .select(`
      passenger_count,
      recorded_at,
      vehicles (
        route_id,
        routes (
          route_name
        )
      )
    `);

  if (startDate) query = query.gte("recorded_at", startDate);
  if (endDate) query = query.lte("recorded_at", endDate);

  const { data, error } = await query;

  if (error) throw error;

  const routeCounts: Record<string, number> = {};

  data?.forEach((row: any) => {

    const route =
      row.vehicles?.routes?.route_name || "Unknown";

    routeCounts[route] =
      (routeCounts[route] || 0) +
      (row.passenger_count || 0);

  });

  return Object.entries(routeCounts).map(([route, passengers]) => ({
    route,
    passengers
  }));
}


/**
 * PEAK PASSENGER HOURS
 */
export async function getPeakPassengerHours({
  startDate,
  endDate
}: any) {

  let query = supabase
    .from("passenger_logs")
    .select("passenger_count, recorded_at");

  if (startDate) query = query.gte("recorded_at", startDate);
  if (endDate) query = query.lte("recorded_at", endDate);

  const { data, error } = await query;

  if (error) throw error;

  const hours: Record<number, number> = {};

  data?.forEach((row: any) => {

    const hour = new Date(row.recorded_at).getHours();

    hours[hour] =
      (hours[hour] || 0) +
      (row.passenger_count || 0);

  });

  return Object.entries(hours).map(([hour, passengers]) => ({
    hour: `${hour}:00`,
    passengers
  }));
}


/**
 * DAILY PASSENGER TREND
 */
export async function getDailyPassengerTrend({
  startDate,
  endDate
}: any) {

  let query = supabase
    .from("passenger_logs")
    .select("passenger_count, recorded_at");

  if (startDate) query = query.gte("recorded_at", startDate);
  if (endDate) query = query.lte("recorded_at", endDate);

  const { data, error } = await query;

  if (error) throw error;

  const days: Record<string, number> = {};

  data?.forEach((row: any) => {

    const day =
      new Date(row.recorded_at)
        .toISOString()
        .split("T")[0];

    days[day] =
      (days[day] || 0) +
      (row.passenger_count || 0);

  });

  return Object.entries(days).map(([date, passengers]) => ({
    date,
    passengers
  }));
}


/**
 * DRIVER PERFORMANCE REPORT
 */
export async function getDriverPerformanceService({
  startDate,
  endDate
}: any) {

  let query = supabase
    .from("trips")
    .select(`
      scheduled_departure_time,
      start_time,
      vehicles (
        drivers (
          first_name,
          last_name
        )
      ),
      trip_date
    `);

  if (startDate) query = query.gte("trip_date", startDate);
  if (endDate) query = query.lte("trip_date", endDate);

  const { data, error } = await query;

  if (error) throw error;

  const stats: Record<string, any> = {};

  data?.forEach((trip: any) => {

    const driver =
      trip.vehicles?.drivers
        ? `${trip.vehicles.drivers.first_name} ${trip.vehicles.drivers.last_name}`
        : "Unknown";

    if (!stats[driver]) {

      stats[driver] = {
        driver,
        trips: 0,
        onTime: 0,
        delayed: 0
      };

    }

    stats[driver].trips++;

    const scheduled = new Date(trip.scheduled_departure_time).getTime();
    const started = new Date(trip.start_time).getTime();

    if (started <= scheduled) {
      stats[driver].onTime++;
    } else {
      stats[driver].delayed++;
    }

  });

  return Object.values(stats);
}

