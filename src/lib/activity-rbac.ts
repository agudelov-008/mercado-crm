import type { ProfileRole } from "@/lib/app-context";

export function canCreateActivityNotes(role: ProfileRole | null): boolean {
  return role === "Admin" || role === "Agent" || role === "Assistant";
}

/** Solo Admin puede editar o eliminar entradas del historial. */
export function canManageActivityLogs(role: ProfileRole | null): boolean {
  return role === "Admin";
}

export function canViewActivityHistory(role: ProfileRole | null): boolean {
  return (
    role === "Admin" ||
    role === "Agent" ||
    role === "Assistant" ||
    role === "Manager" ||
    role === "Affiliate"
  );
}
