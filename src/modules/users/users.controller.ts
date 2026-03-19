import { Request, Response } from "express";
import {
  getUsersService,
  getUserByIdService,
  updateUserService,
  deleteUserService,
  suspendUserService,
  unsuspendUserService,
  createUserService
} from "./users.service";

/* --------------------------------
   HELPER (FIXES string | string[])
-------------------------------- */

const getQueryString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;


/* --------------------------------
   GET USERS
-------------------------------- */

export const getUsers = async (req: Request, res: Response) => {
  try {

    const { search, role, status } = req.query;

    const users = await getUsersService({
      search: getQueryString(search),
      role: getQueryString(role),
      status: getQueryString(status)
    });

    res.json(users);

  } catch (error: any) {

    console.error("GET USERS ERROR:", error);

    res.status(500).json({
      message: error.message
    });

  }
};


/* --------------------------------
   GET USER BY ID
-------------------------------- */

export const getUserById = async (req: Request, res: Response) => {
  try {

    const id = req.params.id as string;

    const user = await getUserByIdService(id);

    res.json(user);

  } catch (error: any) {

    console.error("GET USER ERROR:", error);

    res.status(404).json({
      message: error.message
    });

  }
};


/* --------------------------------
   UPDATE USER
-------------------------------- */

export const updateUser = async (req: Request, res: Response) => {
  try {

    const id = req.params.id as string;

    const {
      first_name,
      middle_name,
      last_name,
      role
    } = req.body;

    const user = await updateUserService(
      id,
      first_name,
      middle_name,
      last_name,
      role
    );

    res.json({
      message: "User updated successfully",
      user
    });

  } catch (error: any) {

    console.error("UPDATE USER ERROR:", error);

    res.status(400).json({
      message: error.message
    });

  }
};


/* --------------------------------
   DELETE USER
-------------------------------- */

export const deleteUser = async (req: Request, res: Response) => {
  try {

    const id = req.params.id as string;

    const user = await deleteUserService(id);

    res.json({
      message: "User deleted",
      user
    });

  } catch (error: any) {

    console.error("DELETE USER ERROR:", error);

    res.status(400).json({
      message: error.message
    });

  }
};


/* --------------------------------
   SUSPEND USER
-------------------------------- */

export const suspendUser = async (req: Request, res: Response) => {
  try {

    const id = req.params.id as string;
    const { days, reason } = req.body;

    if (!days || !reason) {
      return res.status(400).json({
        message: "Days and reason are required"
      });
    }

    const user = await suspendUserService(id, days, reason);

    res.json({
      message: "User suspended",
      user
    });

  } catch (error: any) {

    console.error("SUSPEND USER ERROR:", error);

    res.status(400).json({
      message: error.message
    });

  }
};


/* --------------------------------
   UNSUSPEND USER
-------------------------------- */

export const unsuspendUser = async (req: Request, res: Response) => {
  try {

    const id = req.params.id as string;

    const user = await unsuspendUserService(id);

    res.json({
      message: "User unsuspended",
      user
    });

  } catch (error: any) {

    console.error("UNSUSPEND USER ERROR:", error);

    res.status(400).json({
      message: error.message
    });

  }
};


/* --------------------------------
   CREATE USER
-------------------------------- */

export const createUser = async (req: Request, res: Response) => {
  try {

    const {
      email,
      password,
      first_name,
      middle_name,
      last_name,
      role,
      contact_number,
      license_number
    } = req.body;

    /* ✅ VALIDATION */

    if (!email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({
        message: "Required: email, password, first_name, last_name, role"
      });
    }

    if (role === "driver" && !license_number) {
      return res.status(400).json({
        message: "License number is required for drivers"
      });
    }

    const user = await createUserService({
      email,
      password,
      first_name,
      middle_name,
      last_name,
      role,
      contact_number,
      license_number
    });

    res.status(201).json({
      message: "User created successfully",
      user
    });

  } catch (error: any) {

    console.error("CREATE USER ERROR:", error);

    res.status(400).json({
      message: error.message
    });

  }
};