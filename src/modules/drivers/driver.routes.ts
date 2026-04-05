import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  driverCancelTrip,
  driverCreate,
  driverDelete,
  driverGetAllDrivers,
  driverGetAssignedTrips,
  driverGetDashboardSummary,
  driverTrackingSettings,
  driverGetSchedulableRoutes,
  driverGetTripById,
  driverGetTripHistory,
  driverGetManagementTrip,
  driverEmergency,
  driverGetProfile,
  driverScheduleAssignedTrip,
  driverUpdateLocation,
  driverUpdatePassengerOccupancy,
  driverUpdate,
} from "./driver.controller";
import {
  driverCreateBodySchema,
  driverEmergencyBodySchema,
  driverIdParamSchema,
  driverLocationBodySchema,
  driverPassengerOccupancyBodySchema,
  driverScheduleTripBodySchema,
  driverTripIdParamSchema,
  driverUpdateBodySchema,
} from "./driver.validation";

const router = Router();

router.get("/", authenticateRequest, authorizeRoles("admin", "staff"), driverGetAllDrivers);
router.post("/", authenticateRequest, authorizeRoles("admin", "staff"), validate({ body: driverCreateBodySchema }), driverCreate);
router.put("/:driverId", authenticateRequest, authorizeRoles("admin", "staff"), validate({ body: driverUpdateBodySchema, params: driverIdParamSchema }), driverUpdate);
router.delete("/:driverId", authenticateRequest, authorizeRoles("admin", "staff"), validate({ params: driverIdParamSchema }), driverDelete);

router.use(authenticateRequest, authorizeRoles("driver"));
router.get("/dashboard", driverGetDashboardSummary);
router.get("/tracking-settings", driverTrackingSettings);
router.get("/routes", driverGetSchedulableRoutes);
router.get("/trips/active", driverGetAssignedTrips);
router.get("/trips/history", driverGetTripHistory);
router.post("/trips/schedule", validate({ body: driverScheduleTripBodySchema }), driverScheduleAssignedTrip);
router.patch("/trips/:tripId/cancel", validate({ params: driverTripIdParamSchema }), driverCancelTrip);
router.get("/trips/:tripId/management", validate({ params: driverTripIdParamSchema }), driverGetManagementTrip);
router.get("/trips/:tripId", validate({ params: driverTripIdParamSchema }), driverGetTripById);
router.patch("/trips/:tripId/emergency", validate({ body: driverEmergencyBodySchema, params: driverTripIdParamSchema }), driverEmergency);
router.patch("/trips/:tripId/location", validate({ body: driverLocationBodySchema, params: driverTripIdParamSchema }), driverUpdateLocation);
router.patch("/trips/:tripId/passengers", validate({ body: driverPassengerOccupancyBodySchema, params: driverTripIdParamSchema }), driverUpdatePassengerOccupancy);
router.get("/profile", driverGetProfile);

export default router;
