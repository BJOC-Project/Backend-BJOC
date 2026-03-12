import express from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes";
import driverRoutes from "./modules/drivers/driver.routes";
import userRoutes from "./modules/users/user.routes";
import operatorRoutes from "./modules/operators/operator.routes";
import passengerRoutes from "./modules/passenger/passenger.routes";
import vehicleRoutes from "./modules/vehicles/vehicle.routes";
import routesRouter from "./modules/routes/routes.routes";
import stopsRouter from "./modules/stops/stops.routes";
import tripsRoutes from "./modules/trips/trips.routes";
import notificationRoutes from "./modules/notifications/notification.routes";

const app = express();

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

export default app;