import express from "express";
import {
  fetchNotifications,
  readNotification,
  readAllNotifications
} from "./notification.controller";

const router = express.Router();

router.get("/", fetchNotifications);

router.patch("/:id/read", readNotification);

router.patch("/read-all", readAllNotifications);

export default router;