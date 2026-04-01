import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import { getActivityLogs } from "./activityLogs.controller";
import { activityLogsQuerySchema } from "./activityLogs.validation";

const router = Router();

router.use(authenticateRequest, authorizeRoles("admin"));
router.get("/", validate({ query: activityLogsQuerySchema }), getActivityLogs);

export default router;
