import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { adminGetProfile, adminGetUsers } from "./admin.controller";

const router = Router();

router.use(authenticateRequest, authorizeRoles("admin"));
router.get("/profile", adminGetProfile);
router.get("/users", adminGetUsers);

export default router;
