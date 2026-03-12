import { Router } from "express";
import * as controller from "./user.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { roleMiddleware } from "../../middleware/role.middleware";

const router = Router();

// apply middleware to all routes
router.use(authMiddleware, roleMiddleware(["admin"]));

router.get("/", controller.getUsers);
router.get("/:id", controller.getUserById);
router.put("/:id", controller.updateUser);
router.delete("/:id", controller.deleteUser);

export default router;