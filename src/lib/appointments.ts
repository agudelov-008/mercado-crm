import type { ProfileRole } from "@/lib/app-context";
import { supabase } from "@/lib/supabase";

export interface AppointmentClient {
  first_name: string | null;
  last_name: string | null;
}

export interface Appointment {
  id: string;
  client_phone: string;
  title: string;
  description: string | null;
  starts_at: string;
  created_at: string;
  created_by: string | null;
  clients?: AppointmentClient | AppointmentClient[] | null;
}

export interface CreateAppointmentInput {
  client_phone: string;
  title: string;
  description?: string | null;
  starts_at: string;
  created_by?: string | null;
}

export interface UpdateAppointmentInput {
  title?: string;
  description?: string | null;
  starts_at?: string;
}

const APPOINTMENT_COLUMNS = `
  id,
  client_phone,
  title,
  description,
  starts_at,
  created_at,
  created_by
`;

/** Admin, CRM (Manager) y Asistente ven todas las citas sin filtro por dueño. */
export function isUnrestrictedAppointmentRole(role: ProfileRole): boolean {
  return role === "Admin" || role === "Manager" || role === "Assistant";
}

export type AppointmentAccess = {
  role: ProfileRole;
  authUserId: string;
  /** `profiles.affiliate_name` — filtra `clients.affiliate` para rol Affiliate. */
  affiliateName: string | null;
};

export function buildAppointmentAccess(
  role: ProfileRole,
  authUserId: string,
  affiliateName: string | null,
): AppointmentAccess {
  return {
    role,
    authUserId,
    affiliateName: affiliateName?.trim() || null,
  };
}

function appointmentSelectForAccess(access?: AppointmentAccess): string {
  const clientEmbed = access && !isUnrestrictedAppointmentRole(access.role) && access.role !== "Affiliate"
    ? "clients!inner"
    : "clients";
  return `${APPOINTMENT_COLUMNS}, ${clientEmbed} (first_name, last_name)`;
}

function applyAppointmentClientScope<
  Q extends { eq: (column: string, value: string) => Q },
>(query: Q, access?: AppointmentAccess): Q {
  if (!access || isUnrestrictedAppointmentRole(access.role)) return query;
  if (access.role === "Agent") {
    return query.eq("clients.owner_id", access.authUserId);
  }
  return query;
}

function affiliateAppointmentsUnavailable(access?: AppointmentAccess): boolean {
  return access?.role === "Affiliate" && !access.affiliateName;
}

function normalizeClient(
  clients: Appointment["clients"],
): AppointmentClient | null {
  if (!clients) return null;
  if (Array.isArray(clients)) return clients[0] ?? null;
  return clients;
}

export function getAppointmentClientName(appointment: Appointment): string {
  const client = normalizeClient(appointment.clients);
  if (!client) return appointment.client_phone;
  const name = [client.first_name, client.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || appointment.client_phone;
}

export function formatAppointmentTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Hora en formato 12 h (ej. 02:30 PM) para widgets de agenda. */
export function formatAppointmentTime12h(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function dayRange(day: Date): { from: string; to: string } {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    23,
    59,
    59,
    999,
  );
  return { from: start.toISOString(), to: end.toISOString() };
}

export async function fetchAppointmentsForDay(
  day: Date = new Date(),
  access?: AppointmentAccess,
): Promise<Appointment[]> {
  try {
    if (affiliateAppointmentsUnavailable(access)) return [];

    const { from, to } = dayRange(day);
    let query = supabase
      .from("appointments")
      .select(appointmentSelectForAccess(access))
      .gte("starts_at", from)
      .lte("starts_at", to);

    query = applyAppointmentClientScope(query, access);

    const { data, error } = await query.order("starts_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as Appointment[];
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudieron cargar las citas del día.";
    throw new Error(message);
  }
}

export function formatAppointmentDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface AppointmentDateParts {
  date: string;
  hour: string;
  minute: string;
}

const padTwo = (n: number) => String(n).padStart(2, "0");

/** Descompone un ISO en partes para selectores de fecha/hora independientes. */
export function parseAppointmentDateParts(iso: string): AppointmentDateParts {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { date: "", hour: "09", minute: "00" };
  }
  return {
    date: `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`,
    hour: padTwo(date.getHours()),
    minute: padTwo(date.getMinutes()),
  };
}

/** Compila día + hora + minuto (hora local) a ISO para Supabase. */
export function compileAppointmentIso(
  date: string,
  hour: string,
  minute: string,
): string {
  if (!date.trim()) throw new Error("La fecha es obligatoria.");
  const local = new Date(`${date}T${padTwo(Number(hour))}:${padTwo(Number(minute))}:00`);
  if (Number.isNaN(local.getTime())) {
    throw new Error("La fecha u hora no son válidas.");
  }
  return local.toISOString();
}

export const APPOINTMENT_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  padTwo(i),
);

export const APPOINTMENT_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) =>
  padTwo(i),
);

function monthRange(month: Date): { from: string; to: string } {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getCalendarDays(month: Date): Date[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: Date[] = [];

  for (let i = startOffset; i > 0; i -= 1) {
    days.push(new Date(year, monthIndex, 1 - i));
  }
  for (let d = 1; d <= lastDay.getDate(); d += 1) {
    days.push(new Date(year, monthIndex, d));
  }
  while (days.length % 7 !== 0) {
    const next = days.length - startOffset - lastDay.getDate() + 1;
    days.push(new Date(year, monthIndex + 1, next));
  }
  return days;
}

export async function fetchAppointmentsForMonth(
  month: Date,
  access?: AppointmentAccess,
): Promise<Appointment[]> {
  try {
    if (affiliateAppointmentsUnavailable(access)) return [];

    const { from, to } = monthRange(month);
    let query = supabase
      .from("appointments")
      .select(appointmentSelectForAccess(access))
      .gte("starts_at", from)
      .lte("starts_at", to);

    query = applyAppointmentClientScope(query, access);

    const { data, error } = await query.order("starts_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as Appointment[];
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudieron cargar las citas.";
    throw new Error(message);
  }
}

export async function fetchAppointmentsByPhone(
  phone: string,
  access?: AppointmentAccess,
): Promise<Appointment[]> {
  try {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) return [];
    if (affiliateAppointmentsUnavailable(access)) return [];

    let query = supabase
      .from("appointments")
      .select(appointmentSelectForAccess(access))
      .eq("client_phone", trimmedPhone);

    query = applyAppointmentClientScope(query, access);

    const { data, error } = await query.order("starts_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as Appointment[];
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudieron cargar las citas del cliente.";
    throw new Error(message);
  }
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<Appointment> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user?.id) throw new Error("No autorizado.");

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        client_phone: input.client_phone,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        starts_at: input.starts_at,
        created_by: user.id,
      })
      .select(appointmentSelectForAccess())
      .single();

    if (error) throw error;
    return data as unknown as Appointment;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo crear la cita.";
    throw new Error(message);
  }
}

export async function updateAppointment(
  id: string,
  input: UpdateAppointmentInput,
): Promise<Appointment> {
  try {
    const payload: Record<string, string | null> = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.description !== undefined) {
      payload.description = input.description?.trim() || null;
    }
    if (input.starts_at !== undefined) payload.starts_at = input.starts_at;

    const { data, error } = await supabase
      .from("appointments")
      .update(payload)
      .eq("id", id)
      .select(appointmentSelectForAccess())
      .single();

    if (error) throw error;
    return data as unknown as Appointment;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo actualizar la cita.";
    throw new Error(message);
  }
}

export async function deleteAppointment(id: string): Promise<void> {
  try {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) throw error;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo eliminar la cita.";
    throw new Error(message);
  }
}
