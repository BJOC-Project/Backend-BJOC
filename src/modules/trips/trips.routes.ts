import { Router } from "express";
import { tripsController } from "./trips.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { roleMiddleware } from "../../middleware/role.middleware";

const router = Router();

router.use(authMiddleware);

/* =========================
   GET ACTIVE TRIPS
========================= */
router.get(
  "/active",
  roleMiddleware(["admin", "operator"]),
  tripsController.getActiveTrips
);

/* =========================
   GET TRIP HISTORY
========================= */
router.get(
  "/history",
  roleMiddleware(["admin", "operator"]),
  tripsController.getTripHistory
);

/* =========================
   START (SCHEDULE) TRIP
========================= */
router.post(
  "/start",
  roleMiddleware(["admin","operator"]),
  tripsController.startTrip
);

/* =========================
   RESCHEDULE TRIP
========================= */
router.patch(
  "/:id/reschedule",
  roleMiddleware(["admin","operator"]),
  tripsController.rescheduleTrip
);

/* =========================
   CANCEL TRIP
========================= */
router.patch(
  "/:id/cancel",
  roleMiddleware(["admin","operator"]),
  tripsController.cancelTrip
);

/* =========================
   END TRIP
========================= */
router.put(
  "/:id/end",
  roleMiddleware(["driver","admin", "operator"]),
  tripsController.endTrip
);

export default router;