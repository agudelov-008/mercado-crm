import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Loader2,
  MessageCircle,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/lib/mock-data";
import {
  bulkUpdateLeadStatus,
  clientDetailIdFromPhone,
  CLIENT_TABLE_COLUMNS,
  EMPTY_FILTERS,
  fetchSecureClients,
  formatClientDate,
  LEAD_STATUS_OPTIONS,
  type ClientTableColumnDef,
  type LeadStatus,
  type SecureClient,
  type SecureClientColumn,
  type SecureClientFilters,
  type SecureClientSort,
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
import { MessageModal } from "@/components/MessageModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clients/")({ component: ClientsPage });

const leadStatusStyles: Record<string, string> = {
  New: "bg-info/15 text-info border-info/30",
  Potential: "bg-primary/15 text-primary border-primary/30",
  "Follow-Up": "bg-warning/15 text-warning border-warning/30",
  "Call Again": "bg-warning/15 text-warning border-warning/30",
  Converted: "bg-success/15 text-success border-success/30",
  "Do Not Call": "bg-destructive/15 text-destructive border-destructive/30",
};

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

function getCellValue(row: SecureClient, column: SecureClientColumn): string {
  const value = row[column];
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
    const key = col.key as keyof Pick<
      SecureClientFilters,
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

  if (col.filterType === "select") {
    return (
      <Select
        value={filters.lead_status || "all"}
        onValueChange={(v) =>
          onChange({ ...filters, lead_status: v === "all" ? "" : v })
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
  const [filters, setFilters] = useState<SecureClientFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SecureClientSort | null>(null);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<LeadStatus>("New");
  const [callClient, setCallClient] = useState<Client | null>(null);
  const [msgClient, setMsgClient] = useState<Client | null>(null);

  const queryKey = useMemo(
    () => ["secure-clients", filters, sort] as const,
    [filters, sort],
  );

  const { data: clients = [], isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchSecureClients(filters, sort),
    staleTime: 30_000,
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
      const previous = queryClient.getQueryData<SecureClient[]>(queryKey);
      queryClient.setQueryData<SecureClient[]>(queryKey, (old) =>
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
  const someSelected = selectedPhones.size > 0;

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
    bulkMutation.mutate({ phones, leadStatus: bulkStatus });
  };

  const openClientDetail = (phone: string) => {
    navigate({
      to: "/clients/$id",
      params: { id: clientDetailIdFromPhone(phone) },
    });
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1800px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Cargando clientes…"
            : `${clients.length} cuenta${clients.length === 1 ? "" : "s"} (vista segura)`}
        </p>
      </div>

      {someSelected && (
        <div className="sticky top-0 z-20 rounded-xl border border-primary/40 bg-primary/10 backdrop-blur px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-elegant">
          <p className="text-sm font-medium">
            {selectedPhones.size} cliente
            {selectedPhones.size === 1 ? "" : "s"} seleccionado
            {selectedPhones.size === 1 ? "" : "s"}
          </p>
          <Button
            size="sm"
            onClick={() => setBulkOpen(true)}
            disabled={bulkMutation.isPending}
          >
            Modificar Status Masivo
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1400px]">
            <thead className="bg-surface-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Seleccionar todos"
                  />
                </th>
                {CLIENT_TABLE_COLUMNS.map((col) => (
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
                <th className="px-3 py-1.5 w-10" />
                {CLIENT_TABLE_COLUMNS.map((col) => (
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
              {isLoading && (
                <tr>
                  <td
                    colSpan={CLIENT_TABLE_COLUMNS.length + 2}
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
                    colSpan={CLIENT_TABLE_COLUMNS.length + 2}
                    className="px-4 py-8 text-center text-destructive"
                  >
                    {error instanceof Error
                      ? error.message
                      : "Error al cargar clientes."}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && clients.length === 0 && (
                <tr>
                  <td
                    colSpan={CLIENT_TABLE_COLUMNS.length + 2}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No hay clientes que coincidan con los filtros.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                clients.map((row) => {
                  const modalClient = secureClientToModalClient(row);
                  const isSelected = selectedPhones.has(row.phone);
                  return (
                    <tr
                      key={row.phone}
                      role="button"
                      tabIndex={0}
                      onClick={() => openClientDetail(row.phone)}
                      onKeyDown={(e) => {
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
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(row.phone)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Seleccionar ${row.phone}`}
                        />
                      </td>
                      {CLIENT_TABLE_COLUMNS.map((col) => (
                        <td
                          key={`${row.phone}-${col.key}`}
                          className="px-3 py-3 whitespace-nowrap max-w-[200px] truncate"
                          title={getCellValue(row, col.key)}
                        >
                          {col.key === "lead_status" && row.lead_status ? (
                            <span
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded border",
                                leadStatusStyles[row.lead_status] ??
                                  "bg-muted/30 text-muted-foreground border-border",
                              )}
                            >
                              {row.lead_status}
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMsgClient(modalClient);
                            }}
                            className="h-8 w-8 rounded-md bg-info/15 hover:bg-info/25 text-info border border-info/30 flex items-center justify-center"
                            aria-label="Mensaje"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
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
            onValueChange={(v) => setBulkStatus(v as LeadStatus)}
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
              disabled={bulkMutation.isPending}
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
      <MessageModal
        open={!!msgClient}
        onOpenChange={(o) => !o && setMsgClient(null)}
        client={msgClient}
      />
    </div>
  );
}
