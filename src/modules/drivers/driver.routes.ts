import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { driverGetProfile } from "./driver.controller";

const router = Router();

router.use(authenticateRequest, authorizeRoles("driver"));
router.get("/profile", driverGetProfile);

export default router;
