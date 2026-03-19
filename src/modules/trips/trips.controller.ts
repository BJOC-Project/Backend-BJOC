import { Request, Response } from "express";
import { tripsService } from "./trips.service";

interface ScheduleTripBody {
  vehicle_id: string;
  route_id: string;
  trip_date: string;
  scheduled_departure_time: string;
}

export const tripsController = {

  /* -------------------------
     GET SCHEDULED + ACTIVE TRIPS
  --------------------------*/
  async getActiveTrips(req: Request, res: Response) {
    try {

      const trips = await tripsService.getActiveTrips();

      return res.json(trips);

    } catch (error) {

      console.error("Active trips error:", error);

      return res.status(500).json({
        error: "Failed to fetch trips"
      });

    }
  },

  /* -------------------------
     GET TRIP HISTORY
  --------------------------*/
  async getTripHistory(req: Request, res: Response) {
    try {

      const trips = await tripsService.getTripHistory();

      return res.json(trips);

    } catch (error) {

      console.error("Trip history error:", error);

      return res.status(500).json({
        error: "Failed to fetch trip history"
      });

    }
  },

  /* -------------------------
     ADMIN: SCHEDULE TRIP
  --------------------------*/
  async scheduleTrip(req: Request<{}, {}, ScheduleTripBody>, res: Response) {
    try {

      const {
        vehicle_id,
        route_id,
        trip_date,
        scheduled_departure_time
      } = req.body;

      if (!vehicle_id || !route_id || !trip_date || !scheduled_departure_time) {
        return res.status(400).json({
          error: "vehicle_id, route_id, trip_date, and scheduled_departure_time are required"
        });
      }

      /* CHECK IF VEHICLE ALREADY HAS ACTIVE TRIP */

      const existingTrip =
        await tripsService.getActiveTripByVehicle(vehicle_id);

      if (existingTrip) {
        return res.status(400).json({
          error: "Vehicle already has an active or scheduled trip"
        });
      }

      const trip = await tripsService.scheduleTrip({
        vehicle_id,
        route_id,
        trip_date,
        scheduled_departure_time
      });

      return res.status(201).json(trip);

    } catch (error) {

      console.error("Schedule trip error:", error);

      return res.status(500).json({
        error: "Failed to schedule trip"
      });

    }
  },

  /* -------------------------
     DRIVER: START TRIP
  --------------------------*/
  async startTrip(req: Request<{ id: string }>, res: Response) {
    try {

      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: "Trip ID is required"
        });
      }

      const trip = await tripsService.startTrip(id);

      return res.json(trip);

    } catch (error) {

      console.error("Driver start trip error:", error);

      return res.status(500).json({
        error: "Failed to start trip"
      });

    }
  },

  /* -------------------------
     DRIVER: END TRIP
  --------------------------*/
  async endTrip(req: Request<{ id: string }>, res: Response) {
    try {

      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: "Trip ID is required"
        });
      }

      const trip = await tripsService.endTrip(id);

      return res.json(trip);

    } catch (error) {

      console.error("End trip error:", error);

      return res.status(500).json({
        error: "Failed to end trip"
      });

    }
  },

  /* -------------------------
     CANCEL SCHEDULED TRIP
  --------------------------*/
  async cancelTrip(req: Request<{ id: string }>, res: Response) {
    try {

      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: "Trip ID is required"
        });
      }

      const trip = await tripsService.cancelTrip(id);

      return res.json(trip);

    } catch (error) {

      console.error("Cancel trip error:", error);

      return res.status(500).json({
        error: "Failed to cancel trip"
      });

    }
  },

  /* -------------------------
     RESCHEDULE TRIP
  --------------------------*/
  async rescheduleTrip(
    req: Request<{ id: string }, {}, { scheduled_departure_time: string }>,
    res: Response
  ) {
    try {

      const { id } = req.params;
      const { scheduled_departure_time } = req.body;

      if (!id) {
        return res.status(400).json({
          error: "Trip ID is required"
        });
      }

      if (!scheduled_departure_time) {
        return res.status(400).json({
          error: "scheduled_departure_time is required"
        });
      }

      const trip = await tripsService.rescheduleTrip(
        id,
        scheduled_departure_time
      );

      return res.json(trip);

    } catch (error) {

      console.error("Reschedule trip error:", error);

      return res.status(500).json({
        error: "Failed to reschedule trip"
      });

    }
  }

};

