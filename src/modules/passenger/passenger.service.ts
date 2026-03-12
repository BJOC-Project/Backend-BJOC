import { supabase } from "../../config/supabase";

export async function getPassengers() {

  const { data, error } = await supabase
    .from("passengers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;

}

export async function createPassenger(payload: any) {

  const {
    email,
    password,
    first_name,
    middle_name,
    last_name,
    contact_number
  } = payload;

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

  if (authError) throw authError;

  const userId = authData.user.id;

  const { data, error } = await supabase
    .from("passengers")
    .insert({
      user_id: userId,
      first_name,
      middle_name,
      last_name,
      contact_number,
      email
    })
    .select()
    .single();

  if (error) throw error;

  return data;

}

export async function updatePassenger(id: string, payload: any) {

  const {
    first_name,
    middle_name,
    last_name,
    username,
    contact_number,
    email,
    status
  } = payload;

  const { data, error } = await supabase
    .from("passengers")
    .update({
      first_name,
      middle_name,
      last_name,
      username,
      contact_number,
      email,
      status
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;

}

export async function deletePassenger(id: string) {

  const { error } = await supabase
    .from("passengers")
    .delete()
    .eq("id", id);

  if (error) throw error;

  return true;

}
