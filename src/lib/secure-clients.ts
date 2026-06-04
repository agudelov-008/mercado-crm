import { supabase } from "@/lib/supabase";

/**
 * Valores oficiales del enum `lead_status_type` en PostgreSQL.
 * Label y value deben coincidir textualmente (mayúsculas, espacios, < >).
 */
export const LEAD_STATUS_OPTIONS = [
  "Call Again",
  "Potential",
  "Follow-Up",
  "Voicemail",
  "No Answer",
  "Wrong Number",
  "Wrong Info",
  "No registration",
  "Profiled",
  "Not Workeable",
  "New",
  "Nan",
  "FTD",
  "No Money <3 Days",
  "No Money >3 Days",
  "No interested",
  "Answer and hang up",
] as const;

export type LeadStatus = (typeof LEAD_STATUS_OPTIONS)[number];

const DEFAULT_LEAD_STATUS: LeadStatus = "New";

/** Estilos de badge por estado (tabla y detalle). */
export const LEAD_STATUS_BADGE_STYLES: Record<LeadStatus, string> = {
  New: "bg-info/15 text-info border-info/30",
  Potential: "bg-primary/15 text-primary border-primary/30",
  "Follow-Up": "bg-warning/15 text-warning border-warning/30",
  "Call Again": "bg-warning/15 text-warning border-warning/30",
  Voicemail: "bg-muted/30 text-muted-foreground border-border",
  "No Answer": "bg-muted/30 text-muted-foreground border-border",
  "Wrong Number": "bg-destructive/15 text-destructive border-destructive/30",
  "Wrong Info": "bg-destructive/15 text-destructive border-destructive/30",
  "No registration": "bg-destructive/15 text-destructive border-destructive/30",
  Profiled: "bg-primary/15 text-primary border-primary/30",
  "Not Workeable": "bg-destructive/15 text-destructive border-destructive/30",
  Nan: "bg-muted/30 text-muted-foreground border-border",
  FTD: "bg-success/15 text-success border-success/30",
  "No Money <3 Days": "bg-warning/15 text-warning border-warning/30",
  "No Money >3 Days": "bg-warning/15 text-warning border-warning/30",
  "No interested": "bg-destructive/15 text-destructive border-destructive/30",
  "Answer and hang up": "bg-warning/15 text-warning border-warning/30",
};

/** Variantes de UI/import → etiqueta exacta del enum PostgreSQL `lead_status_type`. */
const LEAD_STATUS_ALIAS_TO_ENUM: Record<string, LeadStatus> = {
  new: "New",
  nuevo: "New",
  potential: "Potential",
  potencial: "Potential",
  potentital: "Potential",
  "follow-up": "Follow-Up",
  "follow up": "Follow-Up",
  followup: "Follow-Up",
  voicemail: "Voicemail",
  "call again": "Call Again",
  "no answer": "No Answer",
  "wrong number": "Wrong Number",
  "wrong info": "Wrong Info",
  "no registration": "No registration",
  profiled: "Profiled",
  "not workeable": "Not Workeable",
  "not workable": "Not Workeable",
  nan: "Nan",
  ftd: "FTD",
  "no money <3 days": "No Money <3 Days",
  "no money >3 days": "No Money >3 Days",
  "no interested": "No interested",
  "not interested": "No interested",
  "answer and hang up": "Answer and hang up",
  converted: "FTD",
  "do not call": "Not Workeable",
};

/**
 * Convierte un string de UI/import al valor exacto del enum en Postgres.
 * Evita 400 por diferencias de mayúsculas o espacios.
 */
export function normalizeLeadStatus(
  value: string | null | undefined,
  options?: { strict?: boolean },
): LeadStatus {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return DEFAULT_LEAD_STATUS;

  const exact = LEAD_STATUS_OPTIONS.find((status) => status === trimmed);
  if (exact) return exact;

  const caseInsensitive = LEAD_STATUS_OPTIONS.find(
    (status) => status.toLowerCase() === trimmed.toLowerCase(),
  );
  if (caseInsensitive) return caseInsensitive;

  const aliasKey = trimmed.toLowerCase().replace(/\s+/g, " ");
  const fromAlias = LEAD_STATUS_ALIAS_TO_ENUM[aliasKey];
  if (fromAlias) return fromAlias;

  const compact = aliasKey.replace(/[-\s]/g, "");
  const compactMatch = LEAD_STATUS_OPTIONS.find(
    (status) =>
      status.toLowerCase().replace(/[-\s]/g, "") === compact ||
      status.toLowerCase().replace(/[\s-]/g, "") === compact,
  );
  if (compactMatch) return compactMatch;

  if (options?.strict) {
    throw new Error(
      `Estado "${trimmed}" no es válido. Valores permitidos: ${LEAD_STATUS_OPTIONS.join(", ")}`,
    );
  }

  return DEFAULT_LEAD_STATUS;
}

export interface SecureClientOwnerProfile {
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export interface SecureClient {
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  affiliate: string | null;
  tp_account: string | null;
  phone: string;
  email: string | null;
  lead_status: LeadStatus | string | null;
  owner_id: string | null;
  total_calls: number;
  previous_lead_status: LeadStatus | string | null;
  previous_owner_id: string | null;
  created_on: string | null;
  last_assignment: string | null;
  last_contacted: string | null;
  updated_at: string | null;
}

/** Cliente con perfiles de asesor actual y anterior resueltos vía join. */
export interface SecureClientWithOwners extends SecureClient {
  owner: SecureClientOwnerProfile | null;
  previous_owner: SecureClientOwnerProfile | null;
}

/** Cliente de detalle con perfiles de asesor resueltos. */
export type SecureClientDetail = SecureClientWithOwners;

export type SecureClientColumn = keyof SecureClient;

export type SortDirection = "asc" | "desc";

export interface SecureClientSort {
  column: SecureClientColumn;
  direction: SortDirection;
}

export type TextFilterKey =
  | "first_name"
  | "last_name"
  | "country"
  | "affiliate"
  | "tp_account"
  | "phone"
  | "email"
  | "owner_id"
  | "previous_owner_id";

export type SelectFilterKey = "lead_status" | "previous_lead_status";

export type NumberFilterKey = "total_calls";

export type DateFilterKey =
  | "created_on"
  | "last_assignment"
  | "last_contacted"
  | "updated_at";

export interface SecureClientFilters {
  first_name: string;
  last_name: string;
  country: string;
  affiliate: string;
  tp_account: string;
  phone: string;
  email: string;
  lead_status: string;
  owner_id: string;
  total_calls: string;
  previous_lead_status: string;
  previous_owner_id: string;
  created_on: string;
  last_assignment: string;
  last_contacted: string;
  updated_at: string;
}

export const EMPTY_FILTERS: SecureClientFilters = {
  first_name: "",
  last_name: "",
  country: "",
  affiliate: "",
  tp_account: "",
  phone: "",
  email: "",
  lead_status: "",
  owner_id: "",
  total_calls: "",
  previous_lead_status: "",
  previous_owner_id: "",
  created_on: "",
  last_assignment: "",
  last_contacted: "",
  updated_at: "",
};

export type ColumnFilterType = "text" | "select" | "date" | "number";

export interface ClientTableColumnDef {
  key: SecureClientColumn;
  label: string;
  filterType: ColumnFilterType;
}

/** Columnas expuestas por la vista `secure_clients` (17 campos de datos). */
export const CLIENT_TABLE_COLUMNS: ClientTableColumnDef[] = [
  { key: "first_name", label: "First Name", filterType: "text" },
  { key: "last_name", label: "Last Name", filterType: "text" },
  { key: "country", label: "Country", filterType: "text" },
  { key: "affiliate", label: "Affiliate", filterType: "text" },
  { key: "tp_account", label: "Tp Account", filterType: "text" },
  { key: "phone", label: "Phone", filterType: "text" },
  { key: "email", label: "Email", filterType: "text" },
  { key: "lead_status", label: "Lead Status", filterType: "select" },
  { key: "owner_id", label: "Owner", filterType: "text" },
  { key: "total_calls", label: "Total Calls", filterType: "number" },
  {
    key: "previous_lead_status",
    label: "Previous Lead Status",
    filterType: "select",
  },
  { key: "previous_owner_id", label: "Previous Owner", filterType: "text" },
  { key: "created_on", label: "Created On", filterType: "date" },
  { key: "last_assignment", label: "Last Assignment", filterType: "date" },
  { key: "last_contacted", label: "Last Contacted", filterType: "date" },
  { key: "updated_at", label: "Updated At", filterType: "date" },
];

const SELECT_COLUMNS = CLIENT_TABLE_COLUMNS.map((c) => c.key).join(",");

const SELECT_WITH_PROFILES = `${SELECT_COLUMNS}, owner:profiles!owner_id(first_name, last_name, email), previous_owner:profiles!previous_owner_id(first_name, last_name, email)`;

const TEXT_FILTER_KEYS: TextFilterKey[] = [
  "first_name",
  "last_name",
  "country",
  "affiliate",
  "tp_account",
  "phone",
  "email",
  "owner_id",
  "previous_owner_id",
];

const SELECT_FILTER_KEYS: SelectFilterKey[] = [
  "lead_status",
  "previous_lead_status",
];

export function clientDetailIdFromPhone(phone: string): string {
  return encodeURIComponent(phone);
}

export function phoneFromClientDetailId(id: string): string {
  return decodeURIComponent(id);
}

export function normalizeOwnerProfile(
  owner: SecureClientOwnerProfile | SecureClientOwnerProfile[] | null | undefined,
): SecureClientOwnerProfile | null {
  if (!owner) return null;
  if (Array.isArray(owner)) return owner[0] ?? null;
  return owner;
}

export function formatOwnerDisplayName(
  owner: SecureClientOwnerProfile | null | undefined,
): string {
  if (!owner) return "Sin asignar";
  const fullName = [owner.first_name, owner.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || owner.email || "Sin asignar";
}

type ClientRowWithProfileJoins = SecureClient & {
  owner?: SecureClientOwnerProfile | SecureClientOwnerProfile[] | null;
  previous_owner?: SecureClientOwnerProfile | SecureClientOwnerProfile[] | null;
};

function mapClientRowWithProfiles(row: ClientRowWithProfileJoins): SecureClientWithOwners {
  const { owner, previous_owner, ...clientFields } = row;
  return {
    ...(clientFields as SecureClient),
    owner: normalizeOwnerProfile(owner),
    previous_owner: normalizeOwnerProfile(previous_owner),
  };
}

export async function fetchSecureClientByPhone(
  phone: string,
): Promise<SecureClientDetail | null> {
  try {
    const { data: fromClients, error: clientsError } = await supabase
      .from("clients")
      .select(SELECT_WITH_PROFILES)
      .eq("phone", phone)
      .maybeSingle();

    if (!clientsError && fromClients) {
      return mapClientRowWithProfiles(fromClients as unknown as ClientRowWithProfileJoins);
    }

    const { data, error } = await supabase
      .from("secure_clients")
      .select(SELECT_WITH_PROFILES)
      .eq("phone", phone)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapClientRowWithProfiles(data as unknown as ClientRowWithProfileJoins);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo cargar el cliente.";
    throw new Error(message);
  }
}

export const CLIENT_PAGE_SIZE_OPTIONS = [12, 24, 48, 100] as const;
export type ClientPageSize = (typeof CLIENT_PAGE_SIZE_OPTIONS)[number];

export type SecureClientsPageResult = {
  rows: SecureClientWithOwners[];
  totalCount: number;
};

export async function fetchSecureClientsByOwnerId(
  ownerId: string,
  filters: SecureClientFilters,
  sort: SecureClientSort | null,
  pagination: { page: number; pageSize: ClientPageSize },
): Promise<SecureClientsPageResult> {
  try {
    const from = pagination.page * pagination.pageSize;
    const to = from + pagination.pageSize - 1;

    let query = supabase
      .from("secure_clients")
      .select(SELECT_WITH_PROFILES, { count: "exact" })
      .eq("owner_id", ownerId);

    for (const key of TEXT_FILTER_KEYS) {
      const value = filters[key].trim();
      if (value) {
        query = query.ilike(key, `%${value}%`);
      }
    }

    for (const key of SELECT_FILTER_KEYS) {
      const value = filters[key].trim();
      if (value) {
        query = query.eq(key, value);
      }
    }

    const totalCallsRaw = filters.total_calls.trim();
    if (totalCallsRaw !== "") {
      const totalCalls = Number(totalCallsRaw);
      if (!Number.isNaN(totalCalls)) {
        query = query.eq("total_calls", totalCalls);
      }
    }

    const dateFilters: Array<{ column: DateFilterKey; value: string }> = [
      { column: "created_on", value: filters.created_on },
      { column: "last_assignment", value: filters.last_assignment },
      { column: "last_contacted", value: filters.last_contacted },
      { column: "updated_at", value: filters.updated_at },
    ];

    for (const { column, value } of dateFilters) {
      if (!value) continue;
      query = query.gte(column, `${value}T00:00:00`).lte(column, `${value}T23:59:59`);
    }

    if (sort) {
      query = query.order(sort.column, {
        ascending: sort.direction === "asc",
        nullsFirst: false,
      });
    } else {
      query = query.order("created_on", {
        ascending: false,
        nullsFirst: false,
      });
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return {
      rows: ((data ?? []) as unknown as ClientRowWithProfileJoins[]).map(
        mapClientRowWithProfiles,
      ),
      totalCount: count ?? 0,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudieron cargar los clientes del asesor.";
    throw new Error(message);
  }
}

export async function fetchSecureClients(
  filters: SecureClientFilters,
  sort: SecureClientSort | null,
  pagination: { page: number; pageSize: ClientPageSize },
): Promise<SecureClientsPageResult> {
  try {
    const from = pagination.page * pagination.pageSize;
    const to = from + pagination.pageSize - 1;

    let query = supabase
      .from("secure_clients")
      .select(SELECT_WITH_PROFILES, { count: "exact" });

    for (const key of TEXT_FILTER_KEYS) {
      const value = filters[key].trim();
      if (value) {
        query = query.ilike(key, `%${value}%`);
      }
    }

    for (const key of SELECT_FILTER_KEYS) {
      const value = filters[key].trim();
      if (value) {
        query = query.eq(key, value);
      }
    }

    const totalCallsRaw = filters.total_calls.trim();
    if (totalCallsRaw !== "") {
      const totalCalls = Number(totalCallsRaw);
      if (!Number.isNaN(totalCalls)) {
        query = query.eq("total_calls", totalCalls);
      }
    }

    const dateFilters: Array<{ column: DateFilterKey; value: string }> = [
      { column: "created_on", value: filters.created_on },
      { column: "last_assignment", value: filters.last_assignment },
      { column: "last_contacted", value: filters.last_contacted },
      { column: "updated_at", value: filters.updated_at },
    ];

    for (const { column, value } of dateFilters) {
      if (!value) continue;
      query = query.gte(column, `${value}T00:00:00`).lte(column, `${value}T23:59:59`);
    }

    if (sort) {
      query = query.order(sort.column, {
        ascending: sort.direction === "asc",
        nullsFirst: false,
      });
    } else {
      query = query.order("created_on", {
        ascending: false,
        nullsFirst: false,
      });
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return {
      rows: ((data ?? []) as unknown as ClientRowWithProfileJoins[]).map(
        mapClientRowWithProfiles,
      ),
      totalCount: count ?? 0,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudieron cargar los clientes.";
    throw new Error(message);
  }
}

export async function updateClientOwner(
  phone: string,
  ownerId: string | null,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("clients")
      .update({ owner_id: ownerId })
      .eq("phone", phone);

    if (error) throw error;
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo asignar el asesor al cliente.";
    throw new Error(message);
  }
}

export async function bulkUpdateClientOwner(
  phones: string[],
  ownerId: string | null,
): Promise<void> {
  if (phones.length === 0) return;

  try {
    const { error } = await supabase
      .from("clients")
      .update({ owner_id: ownerId })
      .in("phone", phones);

    if (error) throw error;
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo asignar el asesor a los clientes seleccionados.";
    throw new Error(message);
  }
}

export async function bulkUpdateLeadStatus(
  phones: string[],
  leadStatus: LeadStatus | string,
): Promise<void> {
  const normalizedStatus = normalizeLeadStatus(leadStatus, { strict: true });

  try {
    const { error } = await supabase
      .from("clients")
      .update({ lead_status: normalizedStatus })
      .in("phone", phones);

    if (error) {
      throw new Error(
        error.message.includes("lead_status")
          ? `${error.message} (valor enviado: "${normalizedStatus}")`
          : error.message,
      );
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo actualizar el estado de los clientes.";
    throw new Error(message);
  }
}

export function formatClientDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatClientDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}
