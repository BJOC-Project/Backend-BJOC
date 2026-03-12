import { supabase } from "../../config/supabase";

export const loginUser = async (email: string, password: string) => {

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  const user = data.user;

  console.log("LOGIN USER ID:", user.id);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("id", user.id)
    .maybeSingle();

  console.log("PROFILE FOUND:", profile);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error("User profile not found");
  }

  return {
    user,
    profile,
    session: data.session,
  };
};