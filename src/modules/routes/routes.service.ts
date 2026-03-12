import { supabase } from "../../config/supabase";

export const routesService = {

  async getRoutes() {

    const { data, error } = await supabase
      .from("routes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data;

  },

  async createRoute(payload: {
    route_name: string;
    start_location?: string;
    end_location?: string;
  }) {

    const { data, error } = await supabase
      .from("routes")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return data;

  },

  async updateRoute(
    id: string,
    payload: {
      route_name?: string;
      start_location?: string;
      end_location?: string;
    }
  ) {

    const { data, error } = await supabase
      .from("routes")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return data;

  },

  /* -------------------------
     DELETE ROUTE
  ------------------------- */

  async deleteRoute(id: string) {

    /* -------------------------
       CHECK ACTIVE TRIPS
       (waiting or ongoing)
    ------------------------- */

    const { data: activeTrips, error: activeError } = await supabase
      .from("trips")
      .select("id")
      .eq("route_id", id)
      .in("status", ["waiting", "ongoing"])
      .limit(1);

    if (activeError) throw activeError;

    if (activeTrips && activeTrips.length > 0) {
      throw new Error(
        "Route cannot be deleted because it has active or scheduled trips."
      );
    }

    /* -------------------------
       DELETE TRIP HISTORY
       (completed trips only)
    ------------------------- */

    const { error: tripDeleteError } = await supabase
      .from("trips")
      .delete()
      .eq("route_id", id);

    if (tripDeleteError) throw tripDeleteError;

    /* -------------------------
       DELETE STOPS
    ------------------------- */

    const { error: stopError } = await supabase
      .from("stops")
      .delete()
      .eq("route_id", id);

    if (stopError) throw stopError;

    /* -------------------------
       DELETE ROUTE
    ------------------------- */

    const { error } = await supabase
      .from("routes")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return { success: true };

  },

  /* -------------------------
     PUBLISH ROUTE
  ------------------------- */

  async publishRoute(routeId: string) {

    const { data: route, error: fetchError } = await supabase
      .from("routes")
      .select("published_version")
      .eq("id", routeId)
      .single();

    if (fetchError) throw fetchError;

    const newVersion = route.published_version + 1;

    const { error } = await supabase
      .from("routes")
      .update({ published_version: newVersion })
      .eq("id", routeId);

    if (error) throw error;

    return {
      success: true,
      published_version: newVersion
    };

  }

};