
import { supabase } from "../../config/supabase";

export async function getDrivers() {

  const { data, error } = await supabase
    .from("drivers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;

}

export async function createDriver(payload: any) {

  const {
    email,
    password,
    first_name,
    middle_name,
    last_name,
    contact_number,
    license_number
  } = payload;

  /* 1️⃣ create auth user */

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

  if (authError) throw authError;

  const userId = authData.user.id;

  /* 2️⃣ insert driver profile */

  const { data, error } = await supabase
    .from("drivers")
    .insert({
      user_id: userId,
      first_name,
      middle_name,
      last_name,
      email,
      contact_number,
      license_number
    })
    .select()
    .single();

  if (error) throw error;

  return data;

}

export async function updateDriver(id: string, payload: any) {

  const {
    first_name,
    middle_name,
    last_name,
    contact_number,
    license_number,
    status
  } = payload;

  const { data, error } = await supabase
    .from("drivers")
    .update({
      first_name,
      middle_name,
      last_name,
      contact_number,
      license_number,
      status
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;

}

export async function deleteDriver(id: string) {
  const { error } = await supabase
    .from("drivers")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return true;
}

