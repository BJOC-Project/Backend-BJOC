import { Request, Response } from "express";
import { routesService } from "./routes.service";

export const routesController = {

  async getRoutes(req: Request, res: Response) {

    try {

      const routes = await routesService.getRoutes();
      res.json(routes);

    } catch (error) {

      console.error("Get routes error:", error);

      res.status(500).json({
        error: "Failed to fetch routes"
      });

    }

  },

  async createRoute(req: Request, res: Response) {

    try {

      const route = await routesService.createRoute(req.body);

      res.json(route);

    } catch (error) {

      console.error("Create route error:", error);

      res.status(500).json({
        error: "Failed to create route"
      });

    }

  },

  async updateRoute(req: Request, res: Response) {

    try {

      const id = req.params.id as string;

      const route = await routesService.updateRoute(id, req.body);

      res.json(route);

    } catch (error) {

      console.error("Update route error:", error);

      res.status(500).json({
        error: "Failed to update route"
      });

    }

  },

  async deleteRoute(req: Request, res: Response) {

    try {

      const id = req.params.id as string;

      const result = await routesService.deleteRoute(id);

      res.json(result);

    } catch (error: any) {

      console.error("Delete route error:", error);

      if (error.message?.includes("trip history")) {

        return res.status(400).json({
          error: error.message
        });

      }

      res.status(500).json({
        error: "Failed to delete route"
      });

    }

  },

  /* -------------------------
         PUBLISH ROUTE
  ------------------------- */

  async publishRoute(req: Request, res: Response) {

    try {

      const id = req.params.id as string;

      const result = await routesService.publishRoute(id);

      res.json(result);

    } catch (error) {

      console.error("Publish route error:", error);

      res.status(500).json({
        error: "Failed to publish route"
      });

    }

  }

};