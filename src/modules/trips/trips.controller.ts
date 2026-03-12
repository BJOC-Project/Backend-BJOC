import { Request, Response } from "express";
import { tripsService } from "./trips.service";

interface StartTripBody {
    vehicle_id: string;
    route_id: string;
    route_direction?: string;
    scheduled_departure_time?: string;
}

export const tripsController = {

    /* -------------------------
       GET ACTIVE + SCHEDULED TRIPS
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
       CREATE SCHEDULED TRIP
    --------------------------*/
    async startTrip(req: Request<{}, {}, StartTripBody>, res: Response) {
        try {

            const {
                vehicle_id,
                route_id,
                route_direction,
                scheduled_departure_time
            } = req.body;

            if (!vehicle_id || !route_id) {
                return res.status(400).json({
                    error: "vehicle_id and route_id are required"
                });
            }

            /* CHECK IF VEHICLE ALREADY HAS TRIP */

            const existingTrip = await tripsService.getActiveTripByVehicle(vehicle_id);

            if (existingTrip) {
                return res.status(400).json({
                    error: "Vehicle already has an active or scheduled trip"
                });
            }

            const trip = await tripsService.startTrip({
                vehicle_id,
                route_id,
                route_direction,
                scheduled_departure_time
            });

            return res.status(201).json(trip);

        } catch (error) {

            console.error("Start trip error:", error);

            return res.status(500).json({
                error: "Failed to start trip"
            });

        }
    },

    /* -------------------------
       END TRIP
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
     CANCEL TRIP
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