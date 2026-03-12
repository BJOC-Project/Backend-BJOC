import { Request, Response } from "express";
import {
  getPassengers,
  createPassenger,
  deletePassenger,
  updatePassenger
} from "./passenger.service";

type PassengerParams = {
  id: string;
};

export async function fetchPassengers(req: Request, res: Response) {

  try {

    const passengers = await getPassengers();

    res.json(passengers);

  } catch (error) {

    res.status(500).json({
      message: "Failed to fetch passengers"
    });

  }

}

export async function addPassenger(req: Request, res: Response) {

  try {

    const passenger = await createPassenger(req.body);

    res.status(201).json(passenger);

  } catch (error: any) {

    console.error("Create passenger error:", error);

    res.status(500).json({
      message: error.message || "Failed to create passenger"
    });

  }

}

export async function editPassenger(
  req: Request<PassengerParams>,
  res: Response
) {

  try {

    const { id } = req.params;

    const updatedPassenger = await updatePassenger(id, req.body);

    res.json(updatedPassenger);

  } catch (error: any) {

    console.error("Update passenger error:", error);

    res.status(500).json({
      message: error.message || "Failed to update passenger"
    });

  }

}

export async function removePassenger(
  req: Request<PassengerParams>,
  res: Response
) {

  try {

    const { id } = req.params;

    await deletePassenger(id);

    res.json({
      message: "Passenger deleted"
    });

  } catch (error) {

    res.status(500).json({
      message: "Failed to delete passenger"
    });

  }

}
