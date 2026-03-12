import { Router } from "express";
import {
  fetchVehicles,
  addVehicle,
  editVehicle,
  removeVehicle,
  fetchVehicleLocations
} from "./vehicle.controller";

const router = Router();

/* =========================
   VEHICLE MAP LOCATIONS
========================= */

router.get("/vehicle-locations", fetchVehicleLocations);

/* =========================
   VEHICLES
========================= */

router.get("/", fetchVehicles);

router.post("/", addVehicle);

router.put("/:id", editVehicle);

router.delete("/:id", removeVehicle);

export default router;