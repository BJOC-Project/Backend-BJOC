import { supabase } from "../../config/supabase";

/* =========================
   GET VEHICLES
========================= */

export async function getVehicles() {

  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      id,
      plate_number,
      model,
      capacity,
      driver_id,
      route_id,
      drivers:driver_id (
        first_name,
        last_name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map((v: any) => {

    const driver = v.drivers;

    return {
      id: v.id,
      plate_number: v.plate_number,
      model: v.model,
      capacity: v.capacity,
      route_id: v.route_id,
      driver_id: v.driver_id,
      driver: driver
        ? `${driver.first_name} ${driver.last_name}`
        : null
    };

  });

}

/* =========================
   CREATE VEHICLE
========================= */

export async function createVehicle(payload: any) {

  const { plate_number, model, capacity } = payload;

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      plate_number,
      model,
      capacity
    })
    .select()
    .single();

  if (error) throw error;

  return data;

}

/* =========================
   UPDATE VEHICLE
========================= */

export async function updateVehicle(id: string, payload: any) {

  const updateData: any = {};

  if (payload.plate_number !== undefined)
    updateData.plate_number = payload.plate_number;

  if (payload.model !== undefined)
    updateData.model = payload.model;

  if (payload.capacity !== undefined)
    updateData.capacity = payload.capacity;

  if (payload.status !== undefined)
    updateData.status = payload.status;

  if (payload.driver_id !== undefined)
    updateData.driver_id = payload.driver_id;

  const { data, error } = await supabase
    .from("vehicles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;

}

/* =========================
   DELETE VEHICLE
========================= */

export async function deleteVehicle(id: string) {

  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", id);

  if (error) throw error;

  return true;

}

/* =========================
   MAP VEHICLE LOCATIONS
========================= */

export async function getVehicleLocations() {

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

}