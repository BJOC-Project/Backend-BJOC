import { Router } from "express";
import { routesController } from "./routes.controller";

const router = Router();

/* =========================
   GET ALL ROUTES
========================= */
router.get("/", routesController.getRoutes);

/* =========================
   CREATE ROUTE
========================= */
router.post("/", routesController.createRoute);

/* =========================
   UPDATE ROUTE
========================= */
router.patch("/:id", routesController.updateRoute);

/* =========================
   DELETE ROUTE
========================= */
router.delete("/:id", routesController.deleteRoute);

/* =========================
   PUBLISH ROUTE
========================= */
router.post("/:id/publish", routesController.publishRoute);

export default router;