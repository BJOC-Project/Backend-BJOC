import { Request, Response } from "express";
import {
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver
} from "./driver.service";

type DriverParams = {
  id: string;
};

export async function fetchDrivers(req: Request, res: Response) {

  try {

    const drivers = await getDrivers();

    res.json(drivers);

  } catch (error) {

    res.status(500).json({
      message: "Failed to fetch drivers"
    });

  }

}

export async function addDriver(req: Request, res: Response) {

  try {

    const driver = await createDriver(req.body);

    res.status(201).json(driver);

  } catch (error: any) {

    console.error("Create driver error:", error);

    res.status(500).json({
      message: error.message || "Failed to create driver"
    });

  }

}

export async function editDriver(
  req: Request<DriverParams>,
  res: Response
) {

  try {

    const { id } = req.params;

    const driver = await updateDriver(id, req.body);

    res.json(driver);

  } catch (error: any) {

    res.status(500).json({
      message: error.message || "Failed to update driver"
    });

  }

}

export async function removeDriver(
  req: Request<DriverParams>,
  res: Response
) {

  try {

    const { id } = req.params;

    await deleteDriver(id);

    res.json({
      message: "Driver deleted"
    });

  } catch (error) {

    res.status(500).json({
      message: "Failed to delete driver"
    });

  }

}
