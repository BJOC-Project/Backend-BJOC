import { Router } from "express";
import {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  suspendUser,
  unsuspendUser,
  createUser 
} from "./users.controller";

const router = Router();


router.get("/", getUsers);

router.get("/:id", getUserById);

router.post("/", createUser);

router.patch("/:id", updateUser);

router.delete("/:id", deleteUser);

router.patch("/:id/suspend", suspendUser);

router.patch("/:id/unsuspend", unsuspendUser);


export default router;