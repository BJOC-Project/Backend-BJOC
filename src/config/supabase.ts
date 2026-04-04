import { createClient } from "@supabase/supabase-js";
import { appEnv } from "./env";

export const supabase =
  appEnv.SUPABASE_URL && appEnv.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
      appEnv.SUPABASE_URL,
      appEnv.SUPABASE_SERVICE_ROLE_KEY,
    )
    : null;
