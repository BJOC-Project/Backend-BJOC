import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ message: "Invalid token" });
  }

  // get role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  (req as any).user = {
    ...data.user,
    role: profile?.role
  };

  next();
};