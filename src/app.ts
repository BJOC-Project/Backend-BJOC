import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./modules/auth/auth.routes";
import driverRoutes from "./modules/drivers/driver.routes";
import userRoutes from "./modules/users/users.routes";
import operatorRoutes from "./modules/operators/operator.routes";
import passengerRoutes from "./modules/passenger/passenger.routes";
import vehicleRoutes from "./modules/vehicles/vehicle.routes";
import routesRouter from "./modules/routes/routes.routes";
import stopsRouter from "./modules/stops/stops.routes";
import tripsRoutes from "./modules/trips/trips.routes";
import notificationRoutes from "./modules/notifications/notification.routes";
import verificationRoutes from "./modules/verification/verification.routes";
import adminRoutes from "./modules/admin/admin.routes"
import reportsRoutes from "./modules/reports/reports.routes";
import activityLogsRoutes from "./modules/activityLogs/activityLogs.routes";

const app = express();
dotenv.config();
app.use(
  cors({
    origin: ["http://localhost:3002", "http://localhost:5173"],
    credentials: true,
  })
);

app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/users", userRoutes);
app.use("/api/operators", operatorRoutes);
app.use("/api/passengers", passengerRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/routes", routesRouter);
app.use("/api/stops", stopsRouter);
app.use("/api/trips", tripsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/admin", adminRoutes)
app.use("/api/admin/reports", reportsRoutes);
app.use("/api/activity-logs", activityLogsRoutes);


export default app;