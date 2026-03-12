import { Request, Response } from "express";
import { stopsService } from "./stops.service";

export const stopsController = {

  async getStopsByRoute(req: Request, res: Response) {
    try {

      const routeId = req.params.routeId as string;

      const data = await stopsService.getStopsByRoute(routeId);

      res.json(data);

    } catch (error) {

      console.error(error);
      res.status(500).json({ error: "Failed to fetch stops" });

    }
  },

  async createStop(req: Request, res: Response) {
    try {

      const data = await stopsService.createStop(req.body);

      res.json(data);

    } catch (error) {

      console.error(error);
      res.status(500).json({ error: "Failed to create stop" });

    }
  },

  async updateStop(req: Request, res: Response) {
    try {

      const id = req.params.id as string;

      const data = await stopsService.updateStop(id, req.body);

      res.json(data);

    } catch (error) {

      console.error(error);
      res.status(500).json({ error: "Failed to update stop" });

    }
  },

  async deleteStop(req: Request, res: Response) {
    try {

      const id = req.params.id as string;

      await stopsService.deleteStop(id);

      res.json({ success: true });

    } catch (error) {

      console.error(error);
      res.status(500).json({ error: "Failed to delete stop" });

    }
  },

  async toggleStopStatus(req: Request, res: Response) {
    try {

      const id = req.params.id as string;

      const { is_active } = req.body;

      const data = await stopsService.toggleStopStatus(id, is_active);

      res.json(data);

    } catch (error) {

      console.error(error);
      res.status(500).json({ error: "Failed to update stop status" });

    }
  },

  async updateStopOrder(req: Request, res: Response) {
    try {

      const stops: { id: string; stop_order: number }[] = req.body;

      await stopsService.updateStopOrder(stops);

      res.json({ success: true });

    } catch (error) {

      console.error(error);
      res.status(500).json({ error: "Failed to update stop order" });

    }
  }

};