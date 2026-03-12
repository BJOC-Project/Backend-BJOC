import { Request, Response } from "express";
import { operatorService } from "./operator.service";

/* VEHICLE LOCATIONS (MAP) */
export const getVehicleLocations = async (req: Request, res: Response) => {
  try {
    const locations = await operatorService.getVehicleLocations();
    res.json(locations);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* DASHBOARD */

export const getFleetSummary = async (req: Request, res: Response) => {
  try {
    const data = await operatorService.getFleetSummary();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getJeepneys = async (req: Request, res: Response) => {
  try {
    const data = await operatorService.getJeepneys();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getStopPopularity = async (req: Request, res: Response) => {
  try {
    const data = await operatorService.getStopPopularity();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getLoadSummary = async (req: Request, res: Response) => {
  try {
    const data = await operatorService.getLoadSummary();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getActiveStops = async (req: Request, res: Response) => {
  try {
    const data = await operatorService.getActiveStops();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getOverallSummary = async (req: Request, res: Response) => {
  try {
    const data = await operatorService.getOverallSummary();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};