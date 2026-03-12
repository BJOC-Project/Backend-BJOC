import { Request, Response } from "express";
import { supabase } from "../../config/supabase";

export const getUsers = async (req: Request, res: Response) => {
  try {

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({
        message: error.message
      });
    }

    res.json(data);

  } catch {
    res.status(500).json({
      message: "Failed to fetch users"
    });
  }
};


export const getUserById = async (req: Request, res: Response) => {

  try {

    const { id } = req.params;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json(data);

  } catch {
    res.status(500).json({
      message: "Failed to fetch user"
    });
  }

};


export const updateUser = async (req: Request, res: Response) => {

  try {

    const { id } = req.params;
    const { name, role } = req.body;

    const allowedRoles = ["admin", "operator", "driver", "passenger"];

    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role"
      });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ name, role })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        message: error.message
      });
    }

    res.json({
      message: "User updated successfully",
      user: data
    });

  } catch {
    res.status(500).json({
      message: "Failed to update user"
    });
  }

};


export const deleteUser = async (req: Request, res: Response) => {

  try {

    const { id } = req.params;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(500).json({
        message: error.message
      });
    }

    res.json({
      message: "User deleted successfully"
    });

  } catch {
    res.status(500).json({
      message: "Failed to delete user"
    });
  }

};