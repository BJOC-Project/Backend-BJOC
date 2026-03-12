import { supabase } from "../../config/supabase";

export const operatorService = {

  /* =========================
     MAP VEHICLE LOCATIONS
  ========================= */

  async getVehicleLocations() {

    const { data, error } = await supabase
      .from("vehicle_locations")
      .select(`
        vehicle_id,
        latitude,
        longitude,
        vehicles:vehicle_id (
          plate_number,
          drivers:driver_id (
            first_name,
            last_name
          )
        )
      `);

    if (error) throw new Error(error.message);

    if (!data) return [];

    return data.map((v: any) => {

      const vehicle = v.vehicles;
      const driver = vehicle?.drivers;

      return {
        vehicle_id: v.vehicle_id,
        latitude: Number(v.latitude),
        longitude: Number(v.longitude),
        plate_number: vehicle?.plate_number ?? null,
        driver: driver
          ? `${driver.first_name} ${driver.last_name}`
          : null,
      };

    });

  },


  /* =========================
     DASHBOARD DATA
  ========================= */

  async getFleetSummary() {

    const { data, error } = await supabase
      .from("vehicles")
      .select("status");

    if (error) throw new Error(error.message);

    const total = data.length;

    const active = data.filter(v => v.status === "active").length;
    const standby = data.filter(v => v.status === "standby").length;
    const offline = data.filter(v => v.status === "offline").length;

    return { total, active, standby, offline };
  },


  async getJeepneys() {

    const { data, error } = await supabase
      .from("vehicles")
      .select(`
        id,
        plate_number,
        status,
        drivers:driver_id (
          first_name,
          last_name
        )
      `);

    if (error) throw new Error(error.message);

    return data.map((v: any) => ({
      plate: v.plate_number,
      driver: v.drivers
        ? `${v.drivers.first_name} ${v.drivers.last_name}`
        : "-",
      route: "-",
      load: 0,
      eta: null,
      status: v.status,
      is_online: v.status === "active",
    }));
  },


  async getStopPopularity() {

    const { data, error } = await supabase
      .from("stops")
      .select("stop_name");

    if (error) throw new Error(error.message);

    return data.map((s: any) => ({
      stop: s.stop_name,
      percentage: Math.floor(Math.random() * 30) + 5,
    }));

  },


  async getLoadSummary() {

    return [
      { date: "Mon", load: 40 },
      { date: "Tue", load: 55 },
      { date: "Wed", load: 60 },
      { date: "Thu", load: 50 },
      { date: "Fri", load: 70 },
    ];

  },


  async getActiveStops() {

    const { data, error } = await supabase
      .from("stops")
      .select("stop_name")
      .limit(6);

    if (error) throw new Error(error.message);

    return data.map((s: any) => ({
      stop: s.stop_name,
      waiting: Math.floor(Math.random() * 20),
    }));

  },


  async getOverallSummary() {

    return {
      trips_today: 12,
      passengers_today: 240,
      avg_load: 65,
      top_route: "Baclaran - Dasma",
    };

  }

};