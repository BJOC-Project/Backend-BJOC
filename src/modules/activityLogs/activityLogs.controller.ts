import { Request, Response } from "express";
import { getActivityLogsService } from "./activityLogs.service";

export const getActivityLogs = async (req: Request, res: Response) => {

  try {

    const { search, module, action } = req.query;

    const logs = await getActivityLogsService(
      search as string,
      module as string,
      action as string
    );

    res.json(logs);

  } catch (error: any) {

    res.status(500).json({
      message: error.message || "Failed to fetch activity logs"
    });

  }

};