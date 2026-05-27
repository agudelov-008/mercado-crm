import { supabase } from "@/lib/supabase";

/** Valores del enum `lead_status` en Supabase (17 estados). */
export const LEAD_STATUS_OPTIONS = [
  "New",
  "Potential",
  "Follow-Up",
  "Call Again",
  "No Answer",
  "Wrong Number",
  "Not Interested",
  "Interested",
  "Qualified",
  "Hot Lead",
  "Warm Lead",
  "Cold Lead",
  "Callback Scheduled",
  "In Progress",
  "Converted",
  "Closed Lost",
  "Do Not Call",
] as const;

export type LeadStatus = (typeof LEAD_STATUS_OPTIONS)[number];

export interface SecureClient {
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  affiliate: string | null;
  tp_account: string | null;
  phone: string;
  email: string | null;
  lead_status: LeadStatus | string | null;
  created_on: string | null;
  last_assignment: string | null;
  last_contacted: string | null;
  updated_at: string | null;
}

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
  | "email";

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
  created_on: "",
  last_assignment: "",
  last_contacted: "",
  updated_at: "",
};

export type ColumnFilterType = "text" | "select" | "date";

export interface ClientTableColumnDef {
  key: SecureClientColumn;
  label: string;
  filterType: ColumnFilterType;
}

/** Columnas expuestas por la vista `secure_clients` (13 campos de datos). */
export const CLIENT_TABLE_COLUMNS: ClientTableColumnDef[] = [
  { key: "first_name", label: "First Name", filterType: "text" },
  { key: "last_name", label: "Last Name", filterType: "text" },
  { key: "country", label: "Country", filterType: "text" },
  { key: "affiliate", label: "Affiliate", filterType: "text" },
  { key: "tp_account", label: "Tp Account", filterType: "text" },
  { key: "phone", label: "Phone", filterType: "text" },
  { key: "email", label: "Email", filterType: "text" },
  { key: "lead_status", label: "Lead Status", filterType: "select" },
  { key: "created_on", label: "Created On", filterType: "date" },
  { key: "last_assignment", label: "Last Assignment", filterType: "date" },
  { key: "last_contacted", label: "Last Contacted", filterType: "date" },
  { key: "updated_at", label: "Updated At", filterType: "date" },
];

const SELECT_COLUMNS = CLIENT_TABLE_COLUMNS.map((c) => c.key).join(",");

const TEXT_FILTER_KEYS: TextFilterKey[] = [
  "first_name",
  "last_name",
  "country",
  "affiliate",
  "tp_account",
  "phone",
  "email",
];

export function clientDetailIdFromPhone(phone: string): string {
  return encodeURIComponent(phone);
}

export function phoneFromClientDetailId(id: string): string {
  return decodeURIComponent(id);
}

export async function fetchSecureClientByPhone(
  phone: string,
): Promise<SecureClient | null> {
  try {
    const { data, error } = await supabase
      .from("secure_clients")
      .select(SELECT_COLUMNS)
      .eq("phone", phone)
      .maybeSingle();

    if (error) throw error;
    return (data as SecureClient | null) ?? null;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo cargar el cliente.";
    throw new Error(message);
  }
}

export async function fetchSecureClients(
  filters: SecureClientFilters,
  sort: SecureClientSort | null,
): Promise<SecureClient[]> {
  try {
    let query = supabase.from("secure_clients").select(SELECT_COLUMNS);

    for (const key of TEXT_FILTER_KEYS) {
      const value = filters[key].trim();
      if (value) {
        query = query.ilike(key, `%${value}%`);
      }
    }

    if (filters.lead_status) {
      query = query.eq("lead_status", filters.lead_status);
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

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as SecureClient[];
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudieron cargar los clientes.";
    throw new Error(message);
  }
}

export async function bulkUpdateLeadStatus(
  phones: string[],
  leadStatus: LeadStatus,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("clients")
      .update({ lead_status: leadStatus })
      .in("phone", phones);

    if (error) throw error;
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
