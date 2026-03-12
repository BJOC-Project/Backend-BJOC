import { Request, Response } from "express";
import * as authService from "./auth.service";

export const login = async (req: Request, res: Response) => {

  try {

    const { email, password } = req.body;

    const result = await authService.loginUser(email, password);

    const role = result.profile.role;

    if (role !== "admin" && role !== "operator") {
      return res.status(403).json({
        message: "Access denied. Not allowed to login in web panel."
      });
    }

    res.json({
      message: "Login successful",
      user: result.profile,
      token: result.session?.access_token
    });

  } catch (error: any) {

    res.status(401).json({
      message: error.message
    });

  }
};