import { Request, Response } from "express";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from "./notification.service";

type Params = {
  id: string;
};

export async function fetchNotifications(req: Request, res: Response) {


  try {

    const role = req.query.role as string;

    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }

    const notifications = await getNotifications(role);

    res.json(notifications);

  } catch (err) {

    console.error(err);

    res.status(500).json({ error: "Failed to fetch notifications" });

  }

}

export async function readNotification(req: Request<Params>, res: Response) {

  try {

    const id = req.params.id;

    if (!id) {
      return res.status(400).json({ error: "Notification ID is required" });
    }

    await markNotificationRead(id);

    res.json({ success: true });

  } catch (err) {

    console.error(err);

    res.status(500).json({ error: "Failed to mark notification as read" });

  }

}

export async function readAllNotifications(req: Request, res: Response) {

  try {

    const role = req.body.role;

    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }

    await markAllNotificationsRead(role);

    res.json({ success: true });

  } catch (err) {

    console.error(err);

    res.status(500).json({ error: "Failed to mark all notifications as read" });

  }

}