import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  vehicleCreate,
  vehicleDelete,
  vehicleGetAll,
  vehicleGetLocations,
  vehicleUpdate,
} from "./vehicles.controller";
import {
  createVehicleBodySchema,
  updateVehicleBodySchema,
  vehicleIdParamSchema,
} from "./vehicles.validation";

const router = Router();

router.use(authenticateRequest, authorizeRoles("admin", "staff"));
router.get("/", vehicleGetAll);
router.post("/", validate({ body: createVehicleBodySchema }), vehicleCreate);
router.put("/:vehicleId", validate({ body: updateVehicleBodySchema, params: vehicleIdParamSchema }), vehicleUpdate);
router.delete("/:vehicleId", validate({ params: vehicleIdParamSchema }), vehicleDelete);
router.get("/vehicle-locations", vehicleGetLocations);

export default router;
