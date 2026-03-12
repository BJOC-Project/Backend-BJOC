import { Request, Response } from "express";
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicleLocations
} from "./vehicle.service";

type VehicleParams = {
  id: string;
};

/* =========================
   VEHICLE LOCATIONS (MAP)
========================= */

export const fetchVehicleLocations = async (
  req: Request,
  res: Response
) => {

  try {

    const locations = await getVehicleLocations();

    return res.json(locations);

  } catch (error: any) {

    console.error("Fetch vehicle locations error:", error);

    return res.status(500).json({
      message: error.message || "Failed to fetch vehicle locations"
    });

  }

};

/* =========================
   FETCH VEHICLES
========================= */

export async function fetchVehicles(
  req: Request,
  res: Response
) {

  try {

    const vehicles = await getVehicles();

    return res.json(vehicles);

  } catch (error) {

    console.error("Fetch vehicles error:", error);

    return res.status(500).json({
      message: "Failed to fetch vehicles"
    });

  }

}

/* =========================
   CREATE VEHICLE
========================= */

export async function addVehicle(
  req: Request,
  res: Response
) {

  try {

    const {
      plate_number,
      model,
      capacity,
      status
    } = req.body;

    const vehicle = await createVehicle({
      plate_number,
      model,
      capacity,
      status
    });

    return res.status(201).json(vehicle);

  } catch (error: any) {

    console.error("Create vehicle error:", error);

    return res.status(500).json({
      message: error.message || "Failed to create vehicle"
    });

  }

}

/* =========================
   UPDATE VEHICLE
========================= */

export async function editVehicle(
  req: Request<VehicleParams>,
  res: Response
) {

  try {

    const { id } = req.params;

    const {
      plate_number,
      model,
      capacity,
      status,
      driver_id
    } = req.body;

    const vehicle = await updateVehicle(id, {
      plate_number,
      model,
      capacity,
      status,
      driver_id
    });

    return res.json(vehicle);

  } catch (error: any) {

    console.error("Update vehicle error:", error);

    return res.status(500).json({
      message: error.message || "Failed to update vehicle"
    });

  }

}

/* =========================
   DELETE VEHICLE
========================= */

export async function removeVehicle(
  req: Request<VehicleParams>,
  res: Response
) {

  try {

    const { id } = req.params;

    await deleteVehicle(id);

    return res.json({
      message: "Vehicle deleted successfully"
    });

  } catch (error) {

    console.error("Delete vehicle error:", error);

    return res.status(500).json({
      message: "Failed to delete vehicle"
    });

  }

}