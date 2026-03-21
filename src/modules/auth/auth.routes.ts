import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { authGetMe, authLoginUser, authRegister } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.schemas";

const router = Router();

router.post("/register", validate(registerSchema), authRegister);
router.post("/login", validate(loginSchema), authLoginUser);
router.get("/me", authenticateRequest, authGetMe);

export default router;
