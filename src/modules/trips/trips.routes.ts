import { Router } from "express";
import { tripsController } from "./trips.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { roleMiddleware } from "../../middleware/role.middleware";

const router = Router();

router.use(authMiddleware);

/* =========================
   GET ACTIVE + SCHEDULED TRIPS
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
   ADMIN: SCHEDULE TRIP
========================= */
router.post(
  "/schedule",
  roleMiddleware(["admin", "operator"]),
  tripsController.scheduleTrip
);

/* =========================
   DRIVER: START TRIP
========================= */
router.patch(
  "/:id/start",
  roleMiddleware(["driver", "admin", "operator"]),
  tripsController.startTrip
);

/* =========================
   RESCHEDULE TRIP
========================= */
router.patch(
  "/:id/reschedule",
  roleMiddleware(["admin", "operator"]),
  tripsController.rescheduleTrip
);

/* =========================
   CANCEL TRIP
========================= */
router.patch(
  "/:id/cancel",
  roleMiddleware(["admin", "operator"]),
  tripsController.cancelTrip
);

/* =========================
   DRIVER: END TRIP
========================= */
router.patch(
  "/:id/end",
  roleMiddleware(["driver", "admin", "operator"]),
  tripsController.endTrip
);

export default router;