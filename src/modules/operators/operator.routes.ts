import { Router } from "express";
import * as operatorController from "./operator.controller";

const router = Router();

/* DASHBOARD */

router.get("/dashboard/fleet-summary", operatorController.getFleetSummary);
router.get("/dashboard/jeepneys", operatorController.getJeepneys);
router.get("/dashboard/stop-popularity", operatorController.getStopPopularity);
router.get("/dashboard/load-summary", operatorController.getLoadSummary);
router.get("/dashboard/active-stops", operatorController.getActiveStops);
router.get("/dashboard/overall", operatorController.getOverallSummary);

/* MAP */

router.get("/vehicle-locations", operatorController.getVehicleLocations);

export default router;