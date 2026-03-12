import { supabase } from "../../config/supabase";
import { createNotification } from '../notifications/notification.service'

export const tripsService = {

  /* -------------------------------
     GET ACTIVE + SCHEDULED TRIPS
  --------------------------------*/
  async getActiveTrips() {

    const { data, error } = await supabase
      .from("trips")
      .select(`
        id,
        vehicle_id,
        start_time,
        scheduled_departure_time,
        status,
        vehicles:vehicle_id (
          plate_number,
          drivers:driver_id (
            first_name,
            last_name
          )
        ),
        routes:route_id (
          route_name
        )
      `)
      .in("status", ["waiting", "ongoing"])
      .order("scheduled_departure_time", { ascending: true });

    if (error) {
      console.error("Supabase trips error:", error);
      throw error;
    }

    if (!data) return [];

    return data.map((t: any) => ({
      id: t.id,
      vehicle_id: t.vehicle_id,
      start_time: t.start_time,
      scheduled_departure_time: t.scheduled_departure_time,
      status: t.status,
      vehicle: t.vehicles?.plate_number ?? null,
      driver: t.vehicles?.drivers
        ? `${t.vehicles.drivers.first_name} ${t.vehicles.drivers.last_name}`
        : null,
      route: t.routes?.route_name ?? null
    }));

  },

  /* -------------------------
     GET TRIP HISTORY
  --------------------------*/
  async getTripHistory() {

    const { data, error } = await supabase
      .from("trips")
      .select(`
        id,
        vehicle_id,
        start_time,
        scheduled_departure_time,
        end_time,
        status,
        vehicles:vehicle_id (
          plate_number,
          drivers:driver_id (
            first_name,
            last_name
          )
        ),
        routes:route_id (
          route_name
        )
      `)
      .eq("status", "completed")
      .order("end_time", { ascending: false });

    if (error) throw error;

    if (!data) return [];

    return data.map((t: any) => ({
      id: t.id,
      vehicle_id: t.vehicle_id,
      start_time: t.start_time,
      scheduled_departure_time: t.scheduled_departure_time,
      end_time: t.end_time,
      status: t.status,
      vehicle: t.vehicles?.plate_number ?? null,
      driver: t.vehicles?.drivers
        ? `${t.vehicles.drivers.first_name} ${t.vehicles.drivers.last_name}`
        : null,
      route: t.routes?.route_name ?? null
    }));

  },

  /* -------------------------
     CHECK ACTIVE TRIP BY VEHICLE
  --------------------------*/
  async getActiveTripByVehicle(vehicle_id: string) {

    const { data, error } = await supabase
      .from("trips")
      .select("id, vehicle_id")
      .eq("vehicle_id", vehicle_id)
      .in("status", ["waiting", "ongoing"])
      .maybeSingle();

    if (error) {
      console.error("Active trip check error:", error);
      throw error;
    }

    return data;

  },

  /* -------------------------
     CREATE SCHEDULED TRIP
  --------------------------*/
  async startTrip(payload: {
    vehicle_id: string;
    route_id: string;
    route_direction?: string;
    scheduled_departure_time?: string;
  }) {

    const { data, error } = await supabase
      .from("trips")
      .insert({
        vehicle_id: payload.vehicle_id,
        route_id: payload.route_id,
        scheduled_departure_time: payload.scheduled_departure_time ?? null,
        status: "waiting",
        current_stop_order: 1
      })
      .select()
      .single();

    if (error) throw error;

    await createNotification({
      title: "Trip Scheduled",
      message: `A new trip has been scheduled`,
      type: "trip",
      target_role: "admin",
      entity_type: "trip",
      entity_id: data.id
    });

    return data;
  },
  /* -------------------------
     END TRIP
  --------------------------*/
  async endTrip(tripId: string) {

    const { data, error } = await supabase
      .from("trips")
      .update({
        status: "completed",
        end_time: new Date()
      })
      .eq("id", tripId)
      .select()
      .single();

    if (error) throw error;

    await createNotification({
      title: "Trip Completed",
      message: `Trip has been completed`,
      type: "trip",
      severity: "success",
      target_role: "admin",
      entity_type: "trip",
      entity_id: tripId
    });

    return data;
  },
  /* -------------------------
          CANCEL TRIP
  --------------------------*/
  async cancelTrip(tripId: string) {

    const { data, error } = await supabase
      .from("trips")
      .update({
        status: "cancelled"
      })
      .eq("id", tripId)
      .eq("status", "waiting")
      .select()
      .single();

    if (error) throw error;

    await createNotification({
      title: "Trip Cancelled",
      message: `A scheduled trip has been cancelled`,
      type: "trip",
      severity: "warning",
      target_role: "admin",
      entity_type: "trip",
      entity_id: tripId
    });

    return data;
  },

  /* -------------------------
     RESCHEDULE TRIP
  --------------------------*/
  async rescheduleTrip(
    tripId: string,
    scheduled_departure_time: string
  ) {

    const { data, error } = await supabase
      .from("trips")
      .update({
        scheduled_departure_time
      })
      .eq("id", tripId)
      .eq("status", "waiting") // only scheduled trips
      .select()
      .single();

    if (error) throw error;

    return data;

  }

};