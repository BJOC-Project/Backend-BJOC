import { supabase } from "../../config/supabase";
import { CreateNotificationDTO } from "./notification.types";

export async function createNotification(data: CreateNotificationDTO) {

  const { error } = await supabase
    .from("notifications")
    .insert([
      {
        title: data.title,
        message: data.message,
        type: data.type,
        severity: data.severity ?? "info",
        target_role: data.target_role,
        entity_id: data.entity_id ?? null,
        entity_type: data.entity_type ?? null,
        metadata: data.metadata ?? {}
      }
    ]);

  if (error) {
    throw error;
  }
}

export async function getNotifications(role: string) {

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .or(`target_role.eq.${role},target_role.eq.all`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function markNotificationRead(id: string) {

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  if (error) {
    throw error;
  }

  return true;
}

export async function markAllNotificationsRead(role: string) {

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("target_role", role)
    .eq("is_read", false);

  if (error) {
    throw error;
  }

  return true;
}