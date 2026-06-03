import { supabase } from "@/lib/supabase";
import {
  formatOwnerDisplayName,
  type SecureClientOwnerProfile,
  type SecureClientWithOwners,
} from "@/lib/secure-clients";

/** Estados terminales excluidos del conteo de leads activos. */
export const TERMINAL_LEAD_STATUSES = ["Lost", "Not Workeable"] as const;

/** Estados operativos críticos mostrados en el widget de distribución. */
export const DASHBOARD_LEAD_DISTRIBUTION_STATUSES = [
  "FTD",
  "Call Again",
  "Follow-Up",
  "New",
  "Profiled",
] as const;

/** Etiquetas de UI para estados del widget (Profiled ≈ pipeline en curso). */
export const DASHBOARD_LEAD_DISTRIBUTION_LABELS: Record<string, string> = {
  Profiled: "In Progress",
};

export const DASHBOARD_LEAD_DISTRIBUTION_COLORS: Record<string, string> = {
  FTD: "var(--success)",
  "Call Again": "var(--warning)",
  "Follow-Up": "var(--warning)",
  New: "var(--info)",
  Profiled: "var(--primary)",
};

const FOLLOW_UP_STATUSES = ["Call Again", "Follow-Up"] as const;

const PRIORITY_CLIENT_SELECT = `
  phone,
  first_name,
  last_name,
  email,
  lead_status,
  last_contacted,
  updated_at,
  owner_id,
  country,
  affiliate,
  tp_account,
  total_calls,
  previous_lead_status,
  previous_owner_id,
  created_on,
  last_assignment,
  owner:profiles!owner_id(first_name, last_name, email),
  previous_owner:profiles!previous_owner_id(first_name, last_name, email)
`;

function normalizeOwnerProfile(
  owner: SecureClientOwnerProfile | SecureClientOwnerProfile[] | null | undefined,
): SecureClientOwnerProfile | null {
  if (!owner) return null;
  if (Array.isArray(owner)) return owner[0] ?? null;
  return owner;
}

function mapPriorityRow(row: Record<string, unknown>): SecureClientWithOwners {
  const { owner, previous_owner, ...clientFields } = row;
  return {
    ...(clientFields as unknown as SecureClientWithOwners),
    owner: normalizeOwnerProfile(
      owner as SecureClientOwnerProfile | SecureClientOwnerProfile[] | null,
    ),
    previous_owner: normalizeOwnerProfile(
      previous_owner as SecureClientOwnerProfile | SecureClientOwnerProfile[] | null,
    ),
  };
}

export interface LeadDistributionItem {
  status: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DashboardMetrics {
  totalClients: number;
  totalCalls: number;
  activeLeads: number;
  ftdCount: number;
  ftdRate: number;
  pendingFollowups: number;
  leadDistribution: LeadDistributionItem[];
}

export function formatTotalCalls(value: number): string {
  return value.toLocaleString("en-US");
}

function isTerminalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (TERMINAL_LEAD_STATUSES as readonly string[]).includes(status);
}

function buildLeadDistribution(
  statusCounts: Map<string, number>,
  total: number,
): LeadDistributionItem[] {
  return DASHBOARD_LEAD_DISTRIBUTION_STATUSES.map((status) => {
    const count = statusCounts.get(status) ?? 0;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      status,
      label: DASHBOARD_LEAD_DISTRIBUTION_LABELS[status] ?? status,
      count,
      percentage,
      color: DASHBOARD_LEAD_DISTRIBUTION_COLORS[status] ?? "var(--muted-foreground)",
    };
  });
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const { data, error } = await supabase
      .from("secure_clients")
      .select("lead_status, total_calls");

    if (error) throw error;

    const rows = data ?? [];
    const totalClients = rows.length;
    const statusCounts = new Map<string, number>();

    let totalCalls = 0;
    let activeLeads = 0;
    let ftdCount = 0;
    let pendingFollowups = 0;

    for (const row of rows) {
      const calls = row.total_calls as number | null;
      if (typeof calls === "number" && !Number.isNaN(calls)) {
        totalCalls += calls;
      }
      const status = row.lead_status as string | null;
      if (status) {
        statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
      }
      if (!isTerminalStatus(status)) {
        activeLeads += 1;
      }
      if (status === "FTD") {
        ftdCount += 1;
      }
      if (status && (FOLLOW_UP_STATUSES as readonly string[]).includes(status)) {
        pendingFollowups += 1;
      }
    }

    const ftdRate =
      totalClients > 0 ? Math.round((ftdCount / totalClients) * 100) : 0;

    return {
      totalClients,
      totalCalls,
      activeLeads,
      ftdCount,
      ftdRate,
      pendingFollowups,
      leadDistribution: buildLeadDistribution(statusCounts, totalClients),
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudieron cargar las métricas del dashboard.";
    throw new Error(message);
  }
}

export async function fetchPriorityClients(
  limit = 6,
): Promise<SecureClientWithOwners[]> {
  try {
    const { data: followUps, error: followUpError } = await supabase
      .from("secure_clients")
      .select(PRIORITY_CLIENT_SELECT)
      .in("lead_status", [...FOLLOW_UP_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (followUpError) throw followUpError;

    const priority = (followUps ?? []).map((row) =>
      mapPriorityRow(row as Record<string, unknown>),
    );

    if (priority.length >= limit) {
      return priority.slice(0, limit);
    }

    const { data: backfill, error: backfillError } = await supabase
      .from("secure_clients")
      .select(PRIORITY_CLIENT_SELECT)
      .order("updated_at", { ascending: false })
      .limit(limit * 4);

    if (backfillError) throw backfillError;

    const exclude = new Set(priority.map((c) => c.phone));
    const extras = (backfill ?? [])
      .map((row) => mapPriorityRow(row as Record<string, unknown>))
      .filter(
        (row) =>
          !exclude.has(row.phone) && !isTerminalStatus(row.lead_status),
      )
      .slice(0, limit - priority.length);

    return [...priority, ...extras];
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudieron cargar los clientes prioritarios.";
    throw new Error(message);
  }
}

export function priorityClientDisplayName(client: SecureClientWithOwners): string {
  const name = [client.first_name, client.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || client.phone;
}

export function priorityClientOwnerLabel(client: SecureClientWithOwners): string {
  return formatOwnerDisplayName(client.owner);
}
