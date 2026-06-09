import type { ProfileRole } from "@/lib/app-context";

export function canViewAppointments(role: ProfileRole | null): boolean {
  return role !== null && role !== "Affiliate";
}

/** Admin, CRM, Asistente y Agente pueden crear, editar y eliminar citas. */
export function canManageAppointments(role: ProfileRole | null): boolean {
  return (
    role === "Admin" ||
    role === "Manager" ||
    role === "Assistant" ||
    role === "Agent"
  );
}

/** Afiliadora no tiene acceso a citas ni calendario. */
export function isAppointmentsReadOnly(role: ProfileRole | null): boolean {
  return role === "Affiliate";
}
