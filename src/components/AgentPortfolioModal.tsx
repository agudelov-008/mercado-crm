import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Briefcase,
  ExternalLink,
  Loader2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { fetchAgentsForOwnerSelect, type TeamProfile } from "@/lib/user-management";
import {
  bulkUpdateClientOwner,
  CLIENT_PAGE_SIZE_OPTIONS,
  clientDetailIdFromPhone,
  EMPTY_FILTERS,
  fetchSecureClientsByOwnerId,
  formatClientDate,
  formatLastContacted,
  LEAD_STATUS_BADGE_STYLES,
  LEAD_STATUS_OPTIONS,
  type ClientPageSize,
  type ClientTableColumnDef,
  type LeadStatus,
  type SecureClientColumn,
  type SecureClientFilters,
  type SecureClientSort,
  type SecureClientWithOwners,
  type SortDirection,
} from "@/lib/secure-clients";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountryDisplay } from "@/lib/country-flags";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { getVisibleClientTableColumns } from "@/lib/role-rbac";

interface AgentPortfolioModalProps {
  agent: TeamProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_COLUMNS: SecureClientColumn[] = [
  "lead_status",
  "previous_lead_status",
];

function profileName(agent: TeamProfile): string {
  const name = [agent.first_name, agent.last_name].filter(Boolean).join(" ").trim();
  return name || agent.email;
}

function getCellValue(row: SecureClientWithOwners, column: SecureClientColumn): string {
  const value = row[column];
  if (column === "total_calls") {
    return value === null || value === undefined ? "—" : String(value);
  }
  if (value === null || value === undefined) return "—";
  if (column === "last_contacted") {
    return formatLastContacted(String(value));
  }
  if (
    column === "created_on" ||
    column === "last_assignment" ||
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

  const dateKey = col.key as
    | "created_on"
    | "last_assignment"
    | "last_contacted"
    | "updated_at";
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

function invalidatePortfolioQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  agentId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: ["agent-portfolio-clients", agentId],
  });
  void queryClient.invalidateQueries({ queryKey: ["team-agents"] });
  void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
  void queryClient.invalidateQueries({ queryKey: ["agent-profiles-owner"] });
  void queryClient.invalidateQueries({ queryKey: ["agent-profiles-bulk-assign"] });
}

export function AgentPortfolioModal({
  agent,
  open,
  onOpenChange,
}: AgentPortfolioModalProps) {
  const queryClient = useQueryClient();
  const { profileRole } = useApp();
  const agentId = agent?.id ?? "";
  const [filters, setFilters] = useState<SecureClientFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SecureClientSort | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<ClientPageSize>(24);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [reassignAgentId, setReassignAgentId] = useState("");

  const queryKey = useMemo(
    () =>
      ["agent-portfolio-clients", agentId, filters, sort, page, pageSize] as const,
    [agentId, filters, sort, page, pageSize],
  );

  useEffect(() => {
    setPage(0);
  }, [filters, sort, pageSize, agentId]);

  useEffect(() => {
    if (!open) {
      setSelectedPhones(new Set());
      setReassignAgentId("");
      setFilters(EMPTY_FILTERS);
      setSort(null);
      setPage(0);
    }
  }, [open]);

  const {
    data: clientsPage,
    isPending,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: () =>
      fetchSecureClientsByOwnerId(agentId, filters, sort, { page, pageSize }),
    enabled: open && !!agentId,
    staleTime: 15_000,
  });

  const clients = clientsPage?.rows ?? [];
  const totalCount = clientsPage?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageFrom = totalCount === 0 ? 0 : page * pageSize + 1;
  const pageTo = Math.min((page + 1) * pageSize, totalCount);
  const portfolioColumns = useMemo(
    () =>
      getVisibleClientTableColumns(profileRole).filter(
        (col) => col.key !== "owner_name" && col.key !== "previous_owner_name",
      ),
    [profileRole],
  );
  const isLoading = isPending || isFetching;
  const tableColSpan = portfolioColumns.length + 2;

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const { data: agentOptions = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agent-profiles-bulk-assign"],
    queryFn: fetchAgentsForOwnerSelect,
    enabled: open,
    staleTime: 60_000,
    select: (rows) => rows.filter((a) => a.id !== agentId),
  });

  const bulkUnassignMutation = useMutation({
    mutationFn: (phones: string[]) => bulkUpdateClientOwner(phones, null),
    onSuccess: (_data, phones) => {
      toast.success(
        `${phones.length} cliente${phones.length === 1 ? "" : "s"} desasignado${phones.length === 1 ? "" : "s"} (cartera libre).`,
      );
      setSelectedPhones(new Set());
      invalidatePortfolioQueries(queryClient, agentId);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "No se pudo desasignar la selección.",
      );
    },
  });

  const bulkReassignMutation = useMutation({
    mutationFn: ({
      phones,
      ownerId,
    }: {
      phones: string[];
      ownerId: string;
    }) => bulkUpdateClientOwner(phones, ownerId),
    onSuccess: (_data, { phones }) => {
      toast.success(
        `${phones.length} cliente${phones.length === 1 ? "" : "s"} reasignado${phones.length === 1 ? "" : "s"}.`,
      );
      setSelectedPhones(new Set());
      setReassignAgentId("");
      invalidatePortfolioQueries(queryClient, agentId);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "No se pudo reasignar la selección.",
      );
    },
  });

  const isBulkProcessing =
    bulkUnassignMutation.isPending || bulkReassignMutation.isPending;

  const allSelected =
    clients.length > 0 && selectedPhones.size === clients.length;
  const hasSelection = selectedPhones.size > 0;

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

  const handleBulkUnassign = () => {
    const phones = Array.from(selectedPhones);
    if (phones.length === 0) return;
    bulkUnassignMutation.mutate(phones);
  };

  const handleBulkReassign = () => {
    const phones = Array.from(selectedPhones);
    if (phones.length === 0) return;
    if (!reassignAgentId) {
      toast.error("Selecciona un asesor destino antes de confirmar.");
      return;
    }
    bulkReassignMutation.mutate({ phones, ownerId: reassignAgentId });
  };

  const handleSort = (column: SecureClientColumn, direction: SortDirection) => {
    setSort({ column, direction });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1800px,96vw)] w-full bg-card border-border max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Gestión masiva de cartera · {agent ? profileName(agent) : "Asesor"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-normal">
            {isLoading
              ? "Cargando clientes asignados…"
              : totalCount === 0
                ? "Este asesor no tiene clientes en su cartera."
                : `Mostrando ${pageFrom}–${pageTo} de ${totalCount} cliente${totalCount === 1 ? "" : "s"} asignados`}
          </p>
        </DialogHeader>

        {hasSelection && (
          <div className="mx-6 mb-3 shrink-0 rounded-xl border border-primary/40 bg-primary/10 backdrop-blur px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {selectedPhones.size} cliente{selectedPhones.size === 1 ? "" : "s"}{" "}
              seleccionado{selectedPhones.size === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={isBulkProcessing}
                onClick={handleBulkUnassign}
              >
                {bulkUnassignMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserMinus className="h-4 w-4" />
                )}
                Desasignar Seleccionados
              </Button>
              <div className="flex items-center gap-2 min-w-[240px]">
                <UserPlus className="h-4 w-4 text-primary shrink-0" />
                <Select
                  value={reassignAgentId || undefined}
                  onValueChange={setReassignAgentId}
                  disabled={isBulkProcessing || agentsLoading}
                >
                  <SelectTrigger className="h-9 bg-surface-elevated border-border text-sm min-w-[180px]">
                    <SelectValue
                      placeholder={
                        agentsLoading ? "Cargando asesores…" : "Reasignar a…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  className="bg-gradient-primary shadow-glow"
                  disabled={isBulkProcessing || !reassignAgentId}
                  onClick={handleBulkReassign}
                >
                  {bulkReassignMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pb-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Clientes por página</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v) as ClientPageSize)}
              disabled={isLoading}
            >
              <SelectTrigger className="h-9 w-[88px] bg-surface-elevated border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isLoading && totalCount > 0 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                disabled={page <= 0 || isBulkProcessing}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Página anterior"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums min-w-[120px] text-center">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                disabled={page >= totalPages - 1 || isBulkProcessing}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Página siguiente"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
          <div className="relative rounded-xl border border-border bg-card/40 overflow-hidden">
            {isBulkProcessing && (
              <div
                className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm"
                aria-live="polite"
                aria-busy="true"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Procesando lote en Supabase…
                </p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1600px]">
                <thead className="bg-surface-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th
                      data-bulk-select-cell
                      className="w-10 px-3 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        disabled={isBulkProcessing || clients.length === 0}
                        aria-label="Seleccionar todos"
                      />
                    </th>
                    {portfolioColumns.map((col) => (
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
                    <th className="text-right px-4 py-3 font-medium min-w-[120px]">
                      Actions
                    </th>
                  </tr>
                  <tr className="border-t border-border/60 normal-case tracking-normal">
                    <th className="px-3 py-1.5 w-10" />
                    {portfolioColumns.map((col) => (
                      <th
                        key={`filter-${col.key}`}
                        className="px-3 py-1.5 align-middle max-w-[140px]"
                      >
                        <ColumnFilter
                          col={col}
                          filters={filters}
                          onChange={setFilters}
                        />
                      </th>
                    ))}
                    <th className="px-4 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
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
                  {isError && !isLoading && (
                    <tr>
                      <td
                        colSpan={tableColSpan}
                        className="px-4 py-8 text-center text-destructive"
                      >
                        {error instanceof Error
                          ? error.message
                          : "Error al cargar la cartera."}
                      </td>
                    </tr>
                  )}
                  {!isLoading && !isError && clients.length === 0 && (
                    <tr>
                      <td
                        colSpan={tableColSpan}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No hay clientes asignados a este asesor.
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    !isError &&
                    clients.map((row) => {
                      const isSelected = selectedPhones.has(row.phone);
                      return (
                        <tr
                          key={row.phone}
                          className={cn(
                            "border-t border-border hover:bg-surface-elevated/40 transition-colors",
                            isSelected && "bg-primary/5",
                          )}
                        >
                          <td
                            data-bulk-select-cell
                            className="px-3 py-3 w-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRow(row.phone)}
                              disabled={isBulkProcessing}
                              aria-label="Seleccionar cliente"
                            />
                          </td>
                          {portfolioColumns.map((col) => (
                            <td
                              key={`${row.phone}-${col.key}`}
                              className="px-3 py-3 whitespace-nowrap max-w-[200px] truncate"
                              title={getCellValue(row, col.key)}
                            >
                              {STATUS_COLUMNS.includes(col.key) &&
                              row[col.key] ? (
                                renderStatusBadge(String(row[col.key]))
                              ) : col.key === "country" ? (
                                <CountryDisplay country={row.country} />
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
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                asChild
                              >
                                <Link
                                  to="/clients/$id"
                                  params={{
                                    id: clientDetailIdFromPhone(row.phone),
                                  }}
                                  search={{}}
                                  onClick={() => onOpenChange(false)}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Ver detalle
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
