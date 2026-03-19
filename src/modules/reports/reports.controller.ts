import { Request, Response } from "express";
import {
  getTripHistoryService,
  getPassengerVolumeByRoute,
  getPeakPassengerHours,
  getDailyPassengerTrend,
  getDriverPerformanceService
} from "./reports.service";

/**
 * TRIP HISTORY
 */
export const getTripHistory = async (req: Request, res: Response) => {

  try {

    const { startDate, endDate, search } = req.query;

    const trips = await getTripHistoryService({
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string
    });

    res.status(200).json({
      success: true,
      data: trips
    });

  } catch (error: any) {

    console.error("Trip history error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


/**
 * PASSENGER VOLUME PER ROUTE
 */
export const getPassengerVolume = async (req: Request, res: Response) => {

  try {

    const { startDate, endDate } = req.query;

    const data = await getPassengerVolumeByRoute({
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data
    });

  } catch (error: any) {

    console.error("Passenger volume error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


/**
 * PEAK PASSENGER HOURS
 */
export const getPeakHours = async (req: Request, res: Response) => {

  try {

    const { startDate, endDate } = req.query;

    const data = await getPeakPassengerHours({
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data
    });

  } catch (error: any) {

    console.error("Peak hours error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


/**
 * DAILY PASSENGER TREND
 */
export const getPassengerTrend = async (req: Request, res: Response) => {

  try {

    const { startDate, endDate } = req.query;

    const data = await getDailyPassengerTrend({
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data
    });

  } catch (error: any) {

    console.error("Passenger trend error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


/**
 * DRIVER PERFORMANCE
 */
export const getDriverPerformance = async (req: Request, res: Response) => {

  try {

    const { startDate, endDate } = req.query;

    const report = await getDriverPerformanceService({
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error: any) {

    console.error("Driver performance error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};