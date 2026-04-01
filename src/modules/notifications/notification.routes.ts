import express from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  fetchNotifications,
  readNotification,
  readAllNotifications
} from "./notification.controller";
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
  readAllNotificationsBodySchema,
} from "./notification.validation";

const router = express.Router();

router.use(authenticateRequest);
router.get("/", validate({ query: notificationListQuerySchema }), fetchNotifications);

router.patch("/:id/read", validate({ params: notificationIdParamSchema }), readNotification);

router.patch("/read-all", validate({ body: readAllNotificationsBodySchema }), readAllNotifications);

export default router;
