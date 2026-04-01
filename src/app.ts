import cors from "cors";
import express, { type Request, type Response } from "express";
import pinoHttp from "pino-http";
import { appEnv } from "./config/env";
import { logger } from "./config/logger";
import { errorMiddleware } from "./middleware/error.middleware";
import { notFoundMiddleware } from "./middleware/not-found.middleware";
import activityLogRoutes from "./modules/activityLogs/activityLogs.routes";
import adminRoutes from "./modules/admin/admin.routes";
import authRoutes from "./modules/auth/auth.routes";
import driverRoutes from "./modules/drivers/driver.routes";
import healthRoutes from "./modules/health/health.routes";
import notificationRoutes from "./modules/notifications/notification.routes";
import operatorRoutes from "./modules/operators/operators.routes";
import passengerRoutes from "./modules/passenger/passenger.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import routeRoutes from "./modules/routes/routes.routes";
import stopRoutes from "./modules/stops/stops.routes";
import staffRoutes from "./modules/staff/staff.routes";
import tripRoutes from "./modules/trips/trips.routes";
import userRoutes from "./modules/users/users.routes";
import vehicleRoutes from "./modules/vehicles/vehicles.routes";

type TimedResponse = Response & {
  responseTime?: number;
};

const app = express();

function buildHttpLogObject(
  req: Request,
  res: TimedResponse,
) {
  return {
    method: req.method,
    path: req.originalUrl,
    statusCode: res.statusCode,
    durationMs: typeof res.responseTime === "number" ? Math.round(res.responseTime) : undefined,
    userId: req.authUser?.userId,
    role: req.authUser?.role,
  };
}

app.disable("x-powered-by");
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === "/api/health",
    },
    quietReqLogger: true,
    customSuccessMessage: () => "HTTP request completed",
    customErrorMessage: () => "HTTP request failed",
    customLogLevel: (
      _req,
      res,
      error,
    ) => {
      if (error || res.statusCode >= 500) {
        return "error";
      }

      if (res.statusCode >= 400) {
        return "warn";
      }

      return "info";
    },
    customSuccessObject: (
      req,
      res,
    ) => buildHttpLogObject(req, res as TimedResponse),
    customErrorObject: (
      req,
      res,
      error,
    ) => ({
      ...buildHttpLogObject(req, res as TimedResponse),
      error,
    }),
  }),
);

function isAllowedCorsOrigin(origin: string) {
  if (appEnv.corsOrigins.includes(origin)) {
    return true;
  }

  if (appEnv.NODE_ENV !== "production") {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  }

  return false;
}

app.use(
  cors({
    origin: (
      origin,
      callback,
    ) => {
      if (!origin || isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin is not allowed"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/stops", stopRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/operators", operatorRoutes);
app.use("/api/admin/reports", reportsRoutes);
app.use("/api/passengers", passengerRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/users", userRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
