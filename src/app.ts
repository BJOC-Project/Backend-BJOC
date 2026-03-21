import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import { appEnv } from "./config/env";
import { logger } from "./config/logger";
import { errorMiddleware } from "./middleware/error.middleware";
import { notFoundMiddleware } from "./middleware/not-found.middleware";
import adminRoutes from "./modules/admin/admin.routes";
import authRoutes from "./modules/auth/auth.routes";
import driverRoutes from "./modules/drivers/driver.routes";
import healthRoutes from "./modules/health/health.routes";
import passengerRoutes from "./modules/passenger/passenger.routes";
import staffRoutes from "./modules/staff/staff.routes";

const app = express();

app.disable("x-powered-by");
app.use(pinoHttp({ logger }));

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
    origin: (origin, callback) => {
      if (!origin || isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin is not allowed"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/passengers", passengerRoutes);
app.use("/api/staff", staffRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
