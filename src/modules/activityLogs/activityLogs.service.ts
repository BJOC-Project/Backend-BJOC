import { supabase } from "../../config/supabase";

export const logActivityService = async (
  module: string,
  action: string,
  description: string,
  performedBy?: string,
  targetUserId?: string,
  entityId?: string
) => {

  const { error } = await supabase
    .from("activity_logs")
    .insert({
      module,
      action,
      description,
      performed_by: performedBy,
      target_user_id: targetUserId,
      entity_id: entityId
    });

  if (error) {
    console.error("Activity log failed:", error.message);
  }

};


export const getActivityLogsService = async (
  search?: string,
  module?: string,
  action?: string
) => {

  let query = supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (module) {
    query = query.eq("module", module);
  }

  if (action) {
    query = query.eq("action", action);
  }

  if (search) {
    query = query.ilike("description", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return data;

};