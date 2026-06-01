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

/** Cliente de detalle con perfil del asesor (owner) resuelto. */
export interface SecureClientDetail extends SecureClient {
  owner: SecureClientOwnerProfile | null;
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

function normalizeOwnerProfile(
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

async function fetchOwnerProfileById(
  ownerId: string,
): Promise<SecureClientOwnerProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", ownerId)
    .maybeSingle();

  if (error) return null;
  return (data as SecureClientOwnerProfile | null) ?? null;
}

function mapClientDetailRow(
  row: SecureClient & {
    owner?: SecureClientOwnerProfile | SecureClientOwnerProfile[] | null;
  },
): SecureClientDetail {
  const { owner, ...clientFields } = row;
  return {
    ...(clientFields as SecureClient),
    owner: normalizeOwnerProfile(owner),
  };
}

export async function fetchSecureClientByPhone(
  phone: string,
): Promise<SecureClientDetail | null> {
  try {
    const detailSelect = `${SELECT_COLUMNS}, owner:profiles!owner_id (first_name, last_name, email)`;

    const { data: fromClients, error: clientsError } = await supabase
      .from("clients")
      .select(detailSelect)
      .eq("phone", phone)
      .maybeSingle();

    if (!clientsError && fromClients) {
      return mapClientDetailRow(
        fromClients as unknown as SecureClient & {
          owner?: SecureClientOwnerProfile | SecureClientOwnerProfile[] | null;
        },
      );
    }

    const { data, error } = await supabase
      .from("secure_clients")
      .select(SELECT_COLUMNS)
      .eq("phone", phone)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const client = data as unknown as SecureClient;
    const owner = client.owner_id
      ? await fetchOwnerProfileById(client.owner_id)
      : null;

    return { ...client, owner };
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

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as SecureClient[];
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
