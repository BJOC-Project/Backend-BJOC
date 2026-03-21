import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { staffGetProfile } from "./staff.controller";

const router = Router();

router.use(authenticateRequest, authorizeRoles("staff"));
router.get("/profile", staffGetProfile);

export default router;
