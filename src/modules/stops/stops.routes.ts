import { Router } from "express";
import { stopsController } from "./stops.controller";

const router = Router();

router.get("/route/:routeId", stopsController.getStopsByRoute);
router.post("/", stopsController.createStop);
router.patch("/:id", stopsController.updateStop);
router.delete("/:id", stopsController.deleteStop);
router.patch("/:id/status", stopsController.toggleStopStatus);
router.put("/route/:routeId/order", stopsController.updateStopOrder);

export default router;