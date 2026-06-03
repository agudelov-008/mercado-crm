import type { ProfileRole } from "@/lib/app-context";
import {
  CLIENT_TABLE_COLUMNS,
  type ClientTableColumnDef,
  type SecureClientColumn,
} from "@/lib/secure-clients";

/** Etiqueta de UI; `Manager` en BD se muestra siempre como CRM. */
export function getProfileRoleLabel(role: ProfileRole): string {
  switch (role) {
    case "Manager":
      return "CRM";
    case "Assistant":
      return "Asistente";
    case "Agent":
      return "Agente";
    case "Affiliate":
      return "Affiliate";
    case "Admin":
      return "Admin";
    default:
      return role;
  }
}

/**
 * Enmascaramiento visual (asteriscos) en tabla y detalle de cliente.
 * Solo aplica al rol `Agent`. Asistente, CRM, Admin y Affiliate ven texto plano.
 */
export function shouldMaskContactInUi(role: ProfileRole | null): boolean {
  return role === "Agent";
}

export function canAssignClients(role: ProfileRole | null): boolean {
  return role === "Admin" || role === "Manager";
}

/** Subida de bases e importación masiva: solo Admin. */
export function canImportClientBases(role: ProfileRole | null): boolean {
  return role === "Admin";
}

export function canAddManualClient(role: ProfileRole | null): boolean {
  return role === "Admin";
}

export function canExportClientsToExcel(role: ProfileRole | null): boolean {
  return role === "Admin" || role === "Manager" || role === "Assistant";
}

/** Excel sin columnas phone/email (CRM y Asistente). */
export function shouldStripContactFromExcelExport(role: ProfileRole | null): boolean {
  return role === "Manager" || role === "Assistant";
}

export function canAccessUserManagement(role: ProfileRole | null): boolean {
  return role === "Admin";
}

export function canAccessAffiliatesModule(role: ProfileRole | null): boolean {
  return role === "Admin";
}

export function canUpdateClientLeadStatus(role: ProfileRole | null): boolean {
  return (
    role === "Admin" ||
    role === "Manager" ||
    role === "Assistant" ||
    role === "Agent"
  );
}

/** Edición de ficha de cliente (modal): solo Admin y Affiliate. */
export function canEditClientProfile(role: ProfileRole | null): boolean {
  return role === "Admin" || role === "Affiliate";
}

const RESTRICTED_COLUMNS_FOR_FIELD_ROLES: SecureClientColumn[] = [
  "owner_id",
  "previous_owner_id",
];

export function getVisibleClientTableColumns(
  role: ProfileRole | null,
): ClientTableColumnDef[] {
  if (role === "Agent" || role === "Affiliate") {
    return CLIENT_TABLE_COLUMNS.filter(
      (col) => !RESTRICTED_COLUMNS_FOR_FIELD_ROLES.includes(col.key),
    );
  }
  return CLIENT_TABLE_COLUMNS;
}

export function canAccessDashboardNav(role: ProfileRole | null): boolean {
  return role !== null && role !== "Affiliate";
}

/** Mensajería (WhatsApp/Escribir): exclusiva de asesores en pista. */
export function canMessageClients(role: ProfileRole | null): boolean {
  return role === "Agent";
}

/** Calendario global: visible para todos los roles (Affiliate en solo lectura). */
export function canAccessTasksNav(role: ProfileRole | null): boolean {
  return role !== null;
}
