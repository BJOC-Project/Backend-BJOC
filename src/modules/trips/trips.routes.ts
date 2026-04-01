import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  tripCancel,
  tripEnd,
  tripGetActive,
  tripGetHistory,
  tripReschedule,
  tripSchedule,
  tripStart,
} from "./trips.controller";
import {
  rescheduleTripBodySchema,
  scheduleTripBodySchema,
  tripEndBodySchema,
  tripIdParamSchema,
} from "./trips.validation";

const router = Router();

router.use(authenticateRequest);
router.get("/active", authorizeRoles("admin", "staff"), tripGetActive);
router.get("/history", authorizeRoles("admin", "staff"), tripGetHistory);
router.post("/schedule", authorizeRoles("admin", "staff"), validate({ body: scheduleTripBodySchema }), tripSchedule);
router.patch("/:tripId/start", authorizeRoles("admin", "staff", "driver"), validate({ params: tripIdParamSchema }), tripStart);
router.patch("/:tripId/end", authorizeRoles("admin", "staff", "driver"), validate({ body: tripEndBodySchema, params: tripIdParamSchema }), tripEnd);
router.patch("/:tripId/cancel", authorizeRoles("admin", "staff"), validate({ params: tripIdParamSchema }), tripCancel);
router.patch("/:tripId/reschedule", authorizeRoles("admin", "staff"), validate({ body: rescheduleTripBodySchema, params: tripIdParamSchema }), tripReschedule);

export default router;
