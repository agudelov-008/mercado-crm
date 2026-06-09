import { supabase } from "@/lib/supabase";

export interface ActivityLogProfile {
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export interface ActivityLog {
  id: string;
  client_phone: string;
  agent_id: string;
  text: string;
  type: string;
  created_at: string;
  profiles: ActivityLogProfile | ActivityLogProfile[] | null;
}

export interface InsertActivityLogInput {
  client_phone: string;
  agent_id: string;
  text: string;
  type?: string;
}

const ACTIVITY_LOG_SELECT = `
  id,
  client_phone,
  agent_id,
  text,
  type,
  created_at,
  profiles (
    first_name,
    last_name,
    email
  )
`;

function normalizeProfile(
  profiles: ActivityLog["profiles"],
): ActivityLogProfile | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0] ?? null;
  return profiles;
}

export function profileDisplayName(profile: ActivityLogProfile | null): string {
  if (!profile) return "Agente desconocido";
  const fullName = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || profile.email || "Agente desconocido";
}

export function formatActivityDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function fetchActivityLogsByPhone(
  phone: string,
): Promise<ActivityLog[]> {
  try {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) return [];

    const { data, error } = await supabase
      .from("activity_logs")
      .select(`
        id,
        client_phone,
        agent_id,
        text,
        type,
        created_at,
        profiles (
          first_name,
          last_name,
          email
        )
      `)
      .eq("client_phone", trimmedPhone)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []) as ActivityLog[];
  } catch (err) {
    console.error("Error en fetchActivityLogsByPhone:", err);
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo cargar el historial de actividad.";
    throw new Error(message);
  }
}

export async function updateActivityLog(
  id: string,
  text: string,
): Promise<ActivityLog> {
  try {
    const { data, error } = await supabase
      .from("activity_logs")
      .update({ text: text.trim() })
      .eq("id", id)
      .select(ACTIVITY_LOG_SELECT)
      .single();

    if (error) throw error;
    return data as ActivityLog;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo actualizar la nota.";
    throw new Error(message);
  }
}

export async function deleteActivityLog(id: string): Promise<void> {
  try {
    const { error } = await supabase.from("activity_logs").delete().eq("id", id);
    if (error) throw error;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo eliminar la nota.";
    throw new Error(message);
  }
}

export async function insertActivityLog(
  input: InsertActivityLogInput,
): Promise<ActivityLog> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user?.id) throw new Error("No autorizado.");

    const { data, error } = await supabase
      .from("activity_logs")
      .insert({
        client_phone: input.client_phone,
        agent_id: user.id,
        text: input.text.trim(),
        type: input.type ?? "comment",
      })
      .select(ACTIVITY_LOG_SELECT)
      .single();

    if (error) throw error;
    return data as ActivityLog;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo guardar la nota.";
    throw new Error(message);
  }
}

export function getActivityAgentName(log: ActivityLog): string {
  return profileDisplayName(normalizeProfile(log.profiles));
}
