import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { passengerGetProfile } from "./passenger.controller";

const router = Router();

router.use(authenticateRequest, authorizeRoles("passenger"));
router.get("/profile", passengerGetProfile);

export default router;
