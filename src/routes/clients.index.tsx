import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileUp,
  Loader2,
  Phone,
  Plus,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/lib/mock-data";
import { fetchAgentsForOwnerSelect } from "@/lib/user-management";
import {
  bulkUpdateClientOwner,
  bulkUpdateLeadStatus,
  clientDetailIdFromPhone,
  CLIENT_TABLE_COLUMNS,
  type ClientTableColumnDef,
  EMPTY_FILTERS,
  fetchSecureClients,
  formatClientDate,
  formatOwnerDisplayName,
  LEAD_STATUS_BADGE_STYLES,
  LEAD_STATUS_OPTIONS,
  normalizeLeadStatus,
  type LeadStatus,
  type SecureClient,
  type SecureClientColumn,
  type SecureClientFilters,
  type SecureClientSort,
  type SecureClientWithOwners,
  type SortDirection,
} from "@/lib/secure-clients";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CallModal } from "@/components/CallModal";
import { ClientImportModal } from "@/components/ClientImportModal";
import { ManualClientModal } from "@/components/ManualClientModal";
import { cn } from "@/lib/utils";
import { useApp, type ProfileRole } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/clients/")({ component: ClientsPage });

function secureClientToModalClient(row: SecureClient): Client {
  const name =
    [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
    row.phone;
  return {
    id: row.phone,
    name,
    email: row.email ?? "",
    phone: row.phone,
    tier: "Moderate",
    portfolioValue: 0,
    targetInvestment: 1,
    netWorthBracket: "",
    kyc: "Pending",
    interests: [],
    assignedAgent: "",
    lastContact: row.last_contacted ?? "",
    avatarColor: "#10b981",
  };
}

const STATUS_COLUMNS: SecureClientColumn[] = [
  "lead_status",
  "previous_lead_status",
];

const RESTRICTED_COLUMNS_FOR_FIELD_ROLES: SecureClientColumn[] = [
  "owner_id",
  "previous_owner_id",
];

function getVisibleColumns(profileRole: ProfileRole | null): ClientTableColumnDef[] {
  if (profileRole === "Agent" || profileRole === "Affiliate") {
    return CLIENT_TABLE_COLUMNS.filter(
      (col) => !RESTRICTED_COLUMNS_FOR_FIELD_ROLES.includes(col.key),
    );
  }
  return CLIENT_TABLE_COLUMNS;
}

function canManageClients(profileRole: ProfileRole | null): boolean {
  return profileRole === "Admin" || profileRole === "Manager";
}

function getCellValue(row: SecureClientWithOwners, column: SecureClientColumn): string {
  if (column === "owner_id") {
    return formatOwnerDisplayName(row.owner);
  }
  if (column === "previous_owner_id") {
    return formatOwnerDisplayName(row.previous_owner);
  }
  const value = row[column];
  if (column === "total_calls") {
    return value === null || value === undefined ? "—" : String(value);
  }
  if (value === null || value === undefined) return "—";
  if (
    column === "created_on" ||
    column === "last_assignment" ||
    column === "last_contacted" ||
    column === "updated_at"
  ) {
    return formatClientDate(String(value));
  }
  return String(value);
}

function renderStatusBadge(status: string) {
  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded border",
        LEAD_STATUS_BADGE_STYLES[status as LeadStatus] ??
          "bg-muted/30 text-muted-foreground border-border",
      )}
    >
      {status}
    </span>
  );
}

function SortButtons({
  column,
  sort,
  onSort,
}: {
  column: SecureClientColumn;
  sort: SecureClientSort | null;
  onSort: (column: SecureClientColumn, direction: SortDirection) => void;
}) {
  const isActive = sort?.column === column;
  return (
    <span className="inline-flex flex-col ml-1 -space-y-1">
      <button
        type="button"
        aria-label={`Ordenar ${column} ascendente`}
        onClick={() => onSort(column, "asc")}
        className={cn(
          "p-0.5 rounded hover:bg-surface-elevated/80",
          isActive && sort?.direction === "asc"
            ? "text-primary"
            : "text-muted-foreground/60",
        )}
      >
        <ArrowUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        aria-label={`Ordenar ${column} descendente`}
        onClick={() => onSort(column, "desc")}
        className={cn(
          "p-0.5 rounded hover:bg-surface-elevated/80",
          isActive && sort?.direction === "desc"
            ? "text-primary"
            : "text-muted-foreground/60",
        )}
      >
        <ArrowDown className="h-3 w-3" />
      </button>
    </span>
  );
}

function ColumnFilter({
  col,
  filters,
  onChange,
}: {
  col: ClientTableColumnDef;
  filters: SecureClientFilters;
  onChange: (next: SecureClientFilters) => void;
}) {
  if (col.filterType === "text") {
    const key = col.key as Extract<
      SecureClientColumn,
      | "first_name"
      | "last_name"
      | "country"
      | "affiliate"
      | "tp_account"
      | "phone"
      | "email"
      | "owner_id"
      | "previous_owner_id"
    >;
    return (
      <Input
        value={filters[key]}
        onChange={(e) => onChange({ ...filters, [key]: e.target.value })}
        placeholder="Filtrar…"
        className="h-7 min-w-0 text-xs p-1 bg-slate-900 border-slate-800 text-slate-300 w-full rounded"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (col.filterType === "number") {
    const key = col.key as "total_calls";
    return (
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={filters[key]}
        onChange={(e) => onChange({ ...filters, [key]: e.target.value })}
        placeholder="0"
        className="h-7 min-w-0 text-xs p-1 bg-slate-900 border-slate-800 text-slate-300 w-full rounded tabular-nums"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Filtrar ${col.label}`}
      />
    );
  }

  if (col.filterType === "select") {
    const key = col.key as "lead_status" | "previous_lead_status";
    return (
      <Select
        value={filters[key] || "all"}
        onValueChange={(v) =>
          onChange({ ...filters, [key]: v === "all" ? "" : v })
        }
      >
        <SelectTrigger
          className="h-7 min-w-0 text-xs p-1 bg-slate-900 border-slate-800 text-slate-300 w-full rounded"
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {LEAD_STATUS_OPTIONS.map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const dateKey = col.key as "created_on" | "last_assignment" | "last_contacted" | "updated_at";
  return (
    <Input
      type="date"
      value={filters[dateKey]}
      onChange={(e) => onChange({ ...filters, [dateKey]: e.target.value })}
      className="h-7 min-w-0 text-xs p-1 bg-slate-900 border-slate-800 text-slate-300 w-full rounded [color-scheme:dark]"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Filtrar ${col.label} por día`}
    />
  );
}

function ClientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { profileRole } = useApp();
  const profileId = user?.id;
  const isProfileReady = !!profileId && profileRole !== null && !isAuthLoading;
  const isAgent = profileRole === "Agent";
  const canManage = canManageClients(profileRole);
  const visibleColumns = useMemo(
    () => getVisibleColumns(profileRole),
    [profileRole],
  );
  const tableColSpan = visibleColumns.length + (canManage ? 2 : 1);
  const [filters, setFilters] = useState<SecureClientFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SecureClientSort | null>(null);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>("New");
  const [bulkAssignAgentId, setBulkAssignAgentId] = useState<string>("");
  const [callClient, setCallClient] = useState<Client | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const queryKey = useMemo(
    () => ["secure-clients", profileId, filters, sort] as const,
    [profileId, filters, sort],
  );

  const {
    data: clients = [],
    isPending,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => fetchSecureClients(filters, sort),
    enabled: isProfileReady,
    staleTime: 30_000,
  });

  const isLoadingClients = !isProfileReady || isPending || isFetching;

  const { data: agentOptions = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agent-profiles-bulk-assign"],
    queryFn: fetchAgentsForOwnerSelect,
    enabled: isProfileReady && canManage,
    staleTime: 60_000,
  });

  const bulkOwnerMutation = useMutation({
    mutationFn: ({
      phones,
      ownerId,
    }: {
      phones: string[];
      ownerId: string;
    }) => bulkUpdateClientOwner(phones, ownerId),
    onMutate: async ({ phones, ownerId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SecureClientWithOwners[]>(queryKey);
      queryClient.setQueryData<SecureClientWithOwners[]>(queryKey, (old) =>
        old?.map((row) =>
          phones.includes(row.phone) ? { ...row, owner_id: ownerId } : row,
        ),
      );
      return { previous };
    },
    onSuccess: (_data, { phones }) => {
      toast.success(
        `Asesor asignado a ${phones.length} cliente${phones.length === 1 ? "" : "s"}.`,
      );
      setSelectedPhones(new Set());
      setBulkAssignAgentId("");
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(
        err instanceof Error ? err.message : "Error al asignar el asesor.",
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({
      phones,
      leadStatus,
    }: {
      phones: string[];
      leadStatus: LeadStatus;
    }) => bulkUpdateLeadStatus(phones, leadStatus),
    onMutate: async ({ phones, leadStatus }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SecureClientWithOwners[]>(queryKey);
      queryClient.setQueryData<SecureClientWithOwners[]>(queryKey, (old) =>
        old?.map((row) =>
          phones.includes(row.phone)
            ? { ...row, lead_status: leadStatus }
            : row,
        ),
      );
      return { previous };
    },
    onSuccess: (_data, { phones }) => {
      toast.success(
        `Estado actualizado para ${phones.length} cliente${phones.length === 1 ? "" : "s"}.`,
      );
      setSelectedPhones(new Set());
      setBulkOpen(false);
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar el estado.",
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
    },
  });

  const handleSort = (column: SecureClientColumn, direction: SortDirection) => {
    setSort({ column, direction });
  };

  const allSelected =
    clients.length > 0 && selectedPhones.size === clients.length;
  const multiSelected = selectedPhones.size >= 2;
  const isBulkProcessing = bulkMutation.isPending || bulkOwnerMutation.isPending;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedPhones(new Set());
      return;
    }
    setSelectedPhones(new Set(clients.map((c) => c.phone)));
  };

  const toggleRow = (phone: string) => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const handleBulkSubmit = () => {
    const phones = Array.from(selectedPhones);
    if (phones.length === 0) return;
    const leadStatus = normalizeLeadStatus(bulkStatus, { strict: true });
    bulkMutation.mutate({ phones, leadStatus });
  };

  const handleBulkAssignOwner = () => {
    const phones = Array.from(selectedPhones);
    if (phones.length < 2) return;
    if (!bulkAssignAgentId) {
      toast.error("Selecciona un asesor antes de confirmar.");
      return;
    }
    bulkOwnerMutation.mutate({ phones, ownerId: bulkAssignAgentId });
  };

  const openClientDetail = (phone: string) => {
    navigate({
      to: "/clients/$id",
      params: { id: clientDetailIdFromPhone(phone) },
    });
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1800px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {isLoadingClients
              ? "Cargando clientes…"
              : isAgent
                ? `${clients.length} cliente${clients.length === 1 ? "" : "s"} en tu cartera`
                : `${clients.length} cuenta${clients.length === 1 ? "" : "s"} (vista segura)`}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setManualOpen(true)}
              className="border-primary/40 bg-primary/10 hover:bg-primary/20"
            >
              <Plus className="h-4 w-4" />
              Agregar Cliente
            </Button>
            <Button
              type="button"
              onClick={() => setImportOpen(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <FileUp className="h-4 w-4" />
              Importar Excel / CSV
            </Button>
          </div>
        )}
      </div>

      {canManage && multiSelected && (
        <div className="sticky top-0 z-20 rounded-xl border border-primary/40 bg-primary/10 backdrop-blur px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-elegant">
          <p className="text-sm font-medium">
            {selectedPhones.size} clientes seleccionados
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 min-w-[220px]">
              <UserCog className="h-4 w-4 text-primary shrink-0" />
              <Select
                value={bulkAssignAgentId || undefined}
                onValueChange={setBulkAssignAgentId}
                disabled={isBulkProcessing || agentsLoading}
              >
                <SelectTrigger className="h-9 bg-surface-elevated border-border text-sm min-w-[180px]">
                  <SelectValue
                    placeholder={
                      agentsLoading ? "Cargando asesores…" : "Asignar asesor…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {agentOptions.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkAssignOwner}
                disabled={isBulkProcessing || !bulkAssignAgentId}
              >
                {bulkOwnerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBulkOpen(true)}
              disabled={isBulkProcessing}
            >
              Modificar Status
            </Button>
          </div>
        </div>
      )}

      <div className="relative rounded-xl border border-border bg-card/40 overflow-hidden">
        {isBulkProcessing && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Procesando lote en Supabase…</p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1800px]">
            <thead className="bg-surface-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {canManage && (
                  <th
                    data-bulk-select-cell
                    className="w-10 px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isBulkProcessing}
                      aria-label="Seleccionar todos"
                    />
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left px-3 py-3 font-medium whitespace-nowrap"
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      <SortButtons
                        column={col.key}
                        sort={sort}
                        onSort={handleSort}
                      />
                    </span>
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-medium min-w-[200px]">
                  Actions
                </th>
              </tr>
              <tr className="border-t border-border/60 normal-case tracking-normal">
                {canManage && <th className="px-3 py-1.5 w-10" />}
                {visibleColumns.map((col) => (
                  <th
                    key={`filter-${col.key}`}
                    className="px-3 py-1.5 align-middle max-w-[140px]"
                  >
                    <div className="flex flex-row items-center min-h-7">
                      <ColumnFilter
                        col={col}
                        filters={filters}
                        onChange={setFilters}
                      />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-1.5 min-w-[200px]" />
              </tr>
            </thead>
            <tbody>
              {isLoadingClients && (
                <tr>
                  <td
                    colSpan={tableColSpan}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Cargando datos desde Supabase…
                  </td>
                </tr>
              )}
              {isError && !isLoadingClients && (
                <tr>
                  <td
                    colSpan={tableColSpan}
                    className="px-4 py-8 text-center text-destructive"
                  >
                    {error instanceof Error
                      ? error.message
                      : "Error al cargar clientes."}
                  </td>
                </tr>
              )}
              {!isLoadingClients && !isError && clients.length === 0 && (
                <tr>
                  <td
                    colSpan={tableColSpan}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No hay clientes que coincidan con los filtros.
                  </td>
                </tr>
              )}
              {!isLoadingClients &&
                !isError &&
                clients.map((row) => {
                  const modalClient = secureClientToModalClient(row);
                  const isSelected = selectedPhones.has(row.phone);
                  return (
                    <tr
                      key={row.phone}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        if (
                          (e.target as HTMLElement).closest(
                            "[data-bulk-select-cell]",
                          )
                        ) {
                          return;
                        }
                        openClientDetail(row.phone);
                      }}
                      onKeyDown={(e) => {
                        if (
                          (e.target as HTMLElement).closest(
                            "[data-bulk-select-cell]",
                          )
                        ) {
                          return;
                        }
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openClientDetail(row.phone);
                        }
                      }}
                      className={cn(
                        "border-t border-border hover:bg-surface-elevated/40 transition-colors cursor-pointer",
                        isSelected && "bg-primary/5",
                      )}
                    >
                      {canManage && (
                        <td
                          data-bulk-select-cell
                          className="px-3 py-3 w-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(row.phone)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isBulkProcessing}
                            aria-label={`Seleccionar ${row.phone}`}
                          />
                        </td>
                      )}
                      {visibleColumns.map((col) => (
                        <td
                          key={`${row.phone}-${col.key}`}
                          className="px-3 py-3 whitespace-nowrap max-w-[200px] truncate"
                          title={getCellValue(row, col.key)}
                        >
                          {STATUS_COLUMNS.includes(col.key) &&
                          row[col.key] ? (
                            renderStatusBadge(String(row[col.key]))
                          ) : col.key === "total_calls" ? (
                            <span className="tabular-nums font-medium">
                              {getCellValue(row, col.key)}
                            </span>
                          ) : (
                            getCellValue(row, col.key)
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex justify-end items-center gap-1.5 flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-primary/30 bg-primary/10 hover:bg-primary/20 text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              openClientDetail(row.phone);
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver detalle
                          </Button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCallClient(modalClient);
                            }}
                            className="h-8 w-8 rounded-md bg-success/15 hover:bg-success/25 text-success border border-success/30 flex items-center justify-center"
                            aria-label="Llamar"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Modificar Status Masivo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Aplicar nuevo Lead Status a {selectedPhones.size} cliente
            {selectedPhones.size === 1 ? "" : "s"} seleccionado
            {selectedPhones.size === 1 ? "" : "s"}.
          </p>
          <Select
            value={bulkStatus}
            onValueChange={(v) => setBulkStatus(normalizeLeadStatus(v))}
          >
            <SelectTrigger className="bg-surface-elevated border-border">
              <SelectValue placeholder="Lead Status" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={isBulkProcessing}
            >
              {bulkMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Aplicar a selección"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CallModal
        open={!!callClient}
        onOpenChange={(o) => !o && setCallClient(null)}
        client={callClient}
      />
      {canManage && (
        <>
          <ClientImportModal open={importOpen} onOpenChange={setImportOpen} />
          <ManualClientModal open={manualOpen} onOpenChange={setManualOpen} />
        </>
      )}
    </div>
  );
}
