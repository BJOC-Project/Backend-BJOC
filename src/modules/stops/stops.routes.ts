import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  stopCreate,
  stopDelete,
  stopGetAll,
  stopGetByRoute,
  stopReorder,
  stopToggle,
  stopUpdate,
} from "./stops.controller";
import {
  createStopBodySchema,
  reorderStopsBodySchema,
  routeIdParamSchema,
  stopIdParamSchema,
  toggleStopStatusBodySchema,
  updateStopBodySchema,
} from "./stops.validation";

const router = Router();

router.use(authenticateRequest, authorizeRoles("admin", "staff"));
router.get("/", stopGetAll);
router.get("/route/:routeId", validate({ params: routeIdParamSchema }), stopGetByRoute);
router.post("/", validate({ body: createStopBodySchema }), stopCreate);
router.patch("/:stopId", validate({ body: updateStopBodySchema, params: stopIdParamSchema }), stopUpdate);
router.delete("/:stopId", validate({ params: stopIdParamSchema }), stopDelete);
router.patch("/:stopId/status", validate({ body: toggleStopStatusBodySchema, params: stopIdParamSchema }), stopToggle);
router.put("/route/:routeId/order", validate({ body: reorderStopsBodySchema, params: routeIdParamSchema }), stopReorder);

export default router;
