import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  passengerGetFavoriteTrips,
  passengerPatchName,
  passengerPatchPassword,
  passengerPatchProfilePhoto,
  passengerGetProfile,
  passengerGetRecentTrips,
  passengerGetTripById,
  passengerGetTrips,
  passengerRequestEmailChangeCode,
  passengerVerifyEmailChangeCode,
} from "./passenger.controller";
import {
  passengerEmailChangeRequestSchema,
  passengerEmailChangeVerifySchema,
  passengerNameUpdateSchema,
  passengerPasswordUpdateSchema,
  passengerProfilePhotoUpdateSchema,
  passengerTripParamsSchema,
} from "./passenger.validation";

const router = Router();

router.use(authenticateRequest, authorizeRoles("passenger"));
router.get("/profile", passengerGetProfile);
router.post(
  "/account/email/request",
  validate(passengerEmailChangeRequestSchema),
  passengerRequestEmailChangeCode,
);
router.post(
  "/account/email/verify",
  validate(passengerEmailChangeVerifySchema),
  passengerVerifyEmailChangeCode,
);
router.patch(
  "/account/password",
  validate(passengerPasswordUpdateSchema),
  passengerPatchPassword,
);
router.patch(
  "/account/name",
  validate(passengerNameUpdateSchema),
  passengerPatchName,
);
router.patch(
  "/account/profile-photo",
  validate(passengerProfilePhotoUpdateSchema),
  passengerPatchProfilePhoto,
);
router.get("/trips/recent", passengerGetRecentTrips);
router.get("/trips/favorites", passengerGetFavoriteTrips);
router.get("/trips/:tripId", validate({ params: passengerTripParamsSchema }), passengerGetTripById);
router.get("/trips", passengerGetTrips);

export default router;
