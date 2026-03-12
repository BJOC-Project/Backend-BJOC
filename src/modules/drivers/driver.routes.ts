import { Router } from "express";
import {
  fetchDrivers,
  addDriver,
  editDriver,
  removeDriver
} from "./driver.controller";

const router = Router();

router.get("/", fetchDrivers);

router.post("/", addDriver);

router.put("/:id", editDriver);

router.delete("/:id", removeDriver);

export default router;