import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  userCreate,
  userDelete,
  userGetById,
  userSuspend,
  userUnsuspend,
  userUpdate,
} from "./users.controller";
import {
  createUserBodySchema,
  suspendUserBodySchema,
  updateUserBodySchema,
  userIdParamSchema,
} from "./users.validation";

const router = Router();

router.use(authenticateRequest, authorizeRoles("admin"));
router.post("/", validate({ body: createUserBodySchema }), userCreate);
router.get("/:userId", validate({ params: userIdParamSchema }), userGetById);
router.patch("/:userId", validate({ body: updateUserBodySchema, params: userIdParamSchema }), userUpdate);
router.delete("/:userId", validate({ params: userIdParamSchema }), userDelete);
router.patch("/:userId/suspend", validate({ body: suspendUserBodySchema, params: userIdParamSchema }), userSuspend);
router.patch("/:userId/unsuspend", validate({ params: userIdParamSchema }), userUnsuspend);

export default router;
