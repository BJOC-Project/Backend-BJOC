export type DriverTripStatus = "scheduled" | "ongoing" | "completed" | "cancelled";
export type DriverMobileTripStatus = "active" | "cancelled" | "completed" | "waiting";

export type DriverEmergencyReasonType = "vehicle_problem" | "other";

export interface DriverDashboardTripCard {
  id: string;
  route_name: string;
  trip_date: string;
  scheduled_departure_time: Date;
  trip_started_at: Date | null;
  trip_ended_at: Date | null;
  start_location: string | null;
  end_location: string | null;
  status: DriverTripStatus;
}

export interface DriverDashboardTripSummaryItem {
  route_name: string;
  passenger_count: number;
  status: Extract<DriverTripStatus, "completed" | "cancelled">;
  trip_date: string;
  trip_ended_at: Date | null;
  trip_started_at: Date | null;
}

export interface DriverDashboardTripStatPoint {
  day: string;
  completed: number;
  cancelled: number;
}

export interface DriverDashboardData {
  current_trip: DriverDashboardTripCard | null;
  driver_name: string;
  trip_stats: DriverDashboardTripStatPoint[];
  trip_summary: DriverDashboardTripSummaryItem[];
  upcoming_trip: DriverDashboardTripCard | null;
}

export type DriverManagementStopStatus = "current" | "passed" | "upcoming";

export interface DriverManagementStop {
  id: string;
  scheduled_time: Date;
  status: DriverManagementStopStatus;
  stop_name: string;
  waiting_count: number;
}

export interface DriverManagementTrip {
  eta_minutes: number;
  next_stop_label: string;
  occupied_seats: number;
  route_name: string;
  seat_capacity: number;
  stops: DriverManagementStop[];
  trip_id: string;
  trip_started_at: Date | null;
  vehicle_code: string | null;
}

export interface DriverMobileTrip {
  dropoff: string;
  estimated_minutes: number | null;
  fare: number;
  id: string;
  pickup: string;
  progress_label: string;
  route_name: string;
  schedule: Date;
  status: DriverMobileTripStatus;
  vehicle_code: string | null;
}

export interface DriverMobileHistoryTrip extends DriverMobileTrip {
  completed_at: Date;
  notes: string;
  stops_made: number;
  total_stops: number;
  trip_started_at: Date | null;
  waited_passengers: number;
}

export interface DriverSchedulableRoute {
  end_location: string | null;
  id: string;
  route_name: string;
  start_location: string | null;
}
