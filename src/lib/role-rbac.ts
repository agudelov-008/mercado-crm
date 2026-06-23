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

/** Agente y Asistente no ven teléfono ni correo del cliente en ninguna pantalla. */
export function canViewClientContactInUi(role: ProfileRole | null): boolean {
  return (
    role !== null && role !== "Agent" && role !== "Assistant"
  );
}

/** @deprecated El Agente ya no ve contacto; el enmascaramiento no aplica a ningún rol. */
export function shouldMaskContactInUi(_role: ProfileRole | null): boolean {
  return false;
}

export function canAssignClients(role: ProfileRole | null): boolean {
  return role === "Admin" || role === "Manager";
}

/** Subida de bases e importación masiva: Admin y Afiliadora (sus propios leads). */
export function canImportClientBases(role: ProfileRole | null): boolean {
  return role === "Admin" || role === "Affiliate";
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

/** Gestión de usuarios: Admin, CRM (Manager) y Asistente. */
export function canAccessUserManagement(role: ProfileRole | null): boolean {
  return role === "Admin" || role === "Manager" || role === "Assistant";
}

/** Crear, editar y eliminar miembros del equipo (no aplica al Asistente). */
export function canCrudTeamUsers(role: ProfileRole | null): boolean {
  return role === "Admin" || role === "Manager";
}

/** El CRM solo puede aprovisionar Asistente y Agente. */
export function getCreatableTeamRoles(
  actorRole: ProfileRole | null,
): Array<"Agent" | "Manager" | "Assistant"> {
  if (actorRole === "Admin") return ["Agent", "Manager", "Assistant"];
  if (actorRole === "Manager") return ["Assistant", "Agent"];
  return [];
}

/** Correo de miembros del equipo en gestión de usuarios: no visible para CRM. */
export function canViewTeamMemberEmailInUi(role: ProfileRole | null): boolean {
  return role !== null && role !== "Manager";
}

/** Editar datos de cuenta (lápiz): solo Admin. */
export function canEditTeamMember(
  actorRole: ProfileRole | null,
  _targetRole: ProfileRole,
): boolean {
  return actorRole === "Admin";
}

/** Admin y CRM pueden eliminar este perfil; Asistente solo lectura. */
export function canManageTeamMember(
  actorRole: ProfileRole | null,
  targetRole: ProfileRole,
): boolean {
  if (actorRole === "Admin") return true;
  if (actorRole === "Manager") {
    return targetRole === "Agent" || targetRole === "Assistant";
  }
  return false;
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

/** Edición de ficha de cliente (modal): solo Admin. La Afiliadora no puede editar. */
export function canEditClientProfile(role: ProfileRole | null): boolean {
  return role === "Admin";
}

/** Eliminación masiva de clientes: exclusivamente Admin. */
export function canBulkDeleteClients(role: ProfileRole | null): boolean {
  return role === "Admin";
}

const RESTRICTED_COLUMNS_FOR_FIELD_ROLES: SecureClientColumn[] = [
  "owner_name",
  "previous_owner_name",
];

const HIDDEN_CONTACT_COLUMNS: SecureClientColumn[] = ["phone", "email"];

export function getVisibleClientTableColumns(
  role: ProfileRole | null,
): ClientTableColumnDef[] {
  let columns = CLIENT_TABLE_COLUMNS;

  if (role === "Agent" || role === "Affiliate") {
    columns = columns.filter(
      (col) => !RESTRICTED_COLUMNS_FOR_FIELD_ROLES.includes(col.key),
    );
  }

  if (role === "Agent" || role === "Assistant") {
    columns = columns.filter(
      (col) => !HIDDEN_CONTACT_COLUMNS.includes(col.key),
    );
  }

  return columns;
}

export function canAccessDashboardNav(role: ProfileRole | null): boolean {
  return role !== null && role !== "Affiliate";
}

/** WhatsApp (wa.me): solo Admin y Asistente; Agentes sin acceso. */
export function canMessageClients(role: ProfileRole | null): boolean {
  return role === "Admin" || role === "Assistant";
}

/** Llamada local (MicroSIP): no disponible para Afiliadora. */
export function canInitiateClientCall(role: ProfileRole | null): boolean {
  return role !== null && role !== "Affiliate";
}

/** Calendario global: visible para todos los roles excepto Afiliadora. */
export function canAccessTasksNav(role: ProfileRole | null): boolean {
  return role !== null && role !== "Affiliate";
}
