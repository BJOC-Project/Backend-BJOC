import { Router } from "express";
import {
  fetchPassengers,
  addPassenger,
  removePassenger,
  editPassenger
} from "./passenger.controller";

const router = Router();

router.get("/", fetchPassengers);

router.post("/", addPassenger);

router.put("/:id", editPassenger); // UPDATE

router.delete("/:id", removePassenger);

export default router;