import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  operatorActiveStopStats,
  operatorAssign,
  operatorDrivers,
  operatorFleetSummary,
  operatorJeepneys,
  operatorLoadStats,
  operatorLocations,
  operatorOverall,
  operatorStopStats,
  operatorVehicles,
} from "./operators.controller";
import { assignDriverBodySchema } from "./operators.validation";

const router = Router();

router.use(authenticateRequest, authorizeRoles("staff"));
router.get("/vehicles", operatorVehicles);
router.get("/drivers", operatorDrivers);
router.post("/assign-driver", validate({ body: assignDriverBodySchema }), operatorAssign);
router.get("/dashboard/fleet-summary", operatorFleetSummary);
router.get("/dashboard/jeepneys", operatorJeepneys);
router.get("/dashboard/stop-popularity", operatorStopStats);
router.get("/dashboard/load-summary", operatorLoadStats);
router.get("/dashboard/active-stops", operatorActiveStopStats);
router.get("/dashboard/overall", operatorOverall);
router.get("/vehicle-locations", operatorLocations);

export default router;
