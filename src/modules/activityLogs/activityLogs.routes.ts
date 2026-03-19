import { Router } from "express";
import { getActivityLogs } from "./activityLogs.controller";

const router = Router();

router.get("/", getActivityLogs);

export default router;