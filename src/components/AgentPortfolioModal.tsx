import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Loader2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  fetchClientsByOwnerId,
  fetchUnassignedClients,
  portfolioClientLabel,
  type PortfolioClient,
  type TeamProfile,
} from "@/lib/user-management";
import { bulkUpdateClientOwner, updateClientOwner } from "@/lib/secure-clients";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AgentPortfolioModalProps {
  agent: TeamProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function profileName(agent: TeamProfile): string {
  const name = [agent.first_name, agent.last_name].filter(Boolean).join(" ").trim();
  return name || agent.email;
}

function ClientListRow({
  client,
  checked,
  onCheckedChange,
  action,
  disabled,
}: {
  client: PortfolioClient;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  action?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/80 bg-surface/50 px-3 py-2.5",
        disabled && "opacity-60 pointer-events-none",
      )}
    >
      {onCheckedChange !== undefined && (
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(!!v)}
          disabled={disabled}
          aria-label={`Seleccionar ${client.phone}`}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{portfolioClientLabel(client)}</p>
        {client.lead_status && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{client.lead_status}</p>
        )}
      </div>
      {action}
    </li>
  );
}

export function AgentPortfolioModal({
  agent,
  open,
  onOpenChange,
}: AgentPortfolioModalProps) {
  const queryClient = useQueryClient();
  const agentId = agent?.id ?? "";
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());

  const assignedQueryKey = ["agent-portfolio-assigned", agentId] as const;
  const unassignedQueryKey = ["agent-portfolio-unassigned"] as const;

  const unassignMutation = useMutation({
    mutationFn: (phone: string) => updateClientOwner(phone, null),
    onSuccess: () => {
      toast.success("Cliente desasignado.");
      void queryClient.invalidateQueries({ queryKey: assignedQueryKey });
      void queryClient.invalidateQueries({ queryKey: unassignedQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
      void queryClient.invalidateQueries({ queryKey: ["team-agents"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "No se pudo desasignar el cliente.",
      );
    },
  });

  const assignMutation = useMutation({
    mutationFn: (phones: string[]) => bulkUpdateClientOwner(phones, agentId),
    onSuccess: (_data, phones) => {
      toast.success(
        `${phones.length} cliente${phones.length === 1 ? "" : "s"} asignado${phones.length === 1 ? "" : "s"} a ${agent ? profileName(agent) : "el asesor"}.`,
      );
      setSelectedUnassigned(new Set());
      void queryClient.invalidateQueries({ queryKey: assignedQueryKey });
      void queryClient.invalidateQueries({ queryKey: unassignedQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
      void queryClient.invalidateQueries({ queryKey: ["team-agents"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "No se pudo asignar los clientes.",
      );
    },
  });

  const isMutating = unassignMutation.isPending || assignMutation.isPending;

  const {
    data: assigned = [],
    isLoading: assignedLoading,
    isError: assignedError,
  } = useQuery({
    queryKey: assignedQueryKey,
    queryFn: () => fetchClientsByOwnerId(agentId),
    enabled: open && !!agentId,
    staleTime: 15_000,
  });

  const {
    data: unassigned = [],
    isLoading: unassignedLoading,
    isError: unassignedError,
  } = useQuery({
    queryKey: unassignedQueryKey,
    queryFn: fetchUnassignedClients,
    enabled: open,
    staleTime: 15_000,
  });

  const allUnassignedSelected =
    unassigned.length > 0 && selectedUnassigned.size === unassigned.length;

  const toggleUnassigned = (phone: string) => {
    setSelectedUnassigned((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const toggleAllUnassigned = () => {
    if (allUnassignedSelected) {
      setSelectedUnassigned(new Set());
      return;
    }
    setSelectedUnassigned(new Set(unassigned.map((c) => c.phone)));
  };

  const handleAssignSelected = () => {
    const phones = Array.from(selectedUnassigned);
    if (phones.length === 0) {
      toast.error("Selecciona al menos un cliente sin asignar.");
      return;
    }
    assignMutation.mutate(phones);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setSelectedUnassigned(new Set());
    onOpenChange(next);
  };

  const assignCountLabel = useMemo(
    () =>
      selectedUnassigned.size > 0
        ? `Asignar selección (${selectedUnassigned.size})`
        : "Asignar selección",
    [selectedUnassigned.size],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Cartera · {agent ? profileName(agent) : "Asesor"}
          </DialogTitle>
        </DialogHeader>

        {isMutating && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            Procesando cambios en Supabase…
          </div>
        )}

        <Tabs defaultValue="assigned" className="flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-2 bg-surface-elevated">
            <TabsTrigger value="assigned">
              Clientes asignados ({assignedLoading ? "…" : assigned.length})
            </TabsTrigger>
            <TabsTrigger value="unassigned">
              Asignar clientes ({unassignedLoading ? "…" : unassigned.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assigned" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[min(420px,50vh)] pr-3">
              {assignedLoading && (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              {assignedError && !assignedLoading && (
                <p className="text-sm text-destructive py-4 text-center">
                  No se pudieron cargar los clientes asignados.
                </p>
              )}
              {!assignedLoading && !assignedError && assigned.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Este asesor no tiene clientes en su cartera.
                </p>
              )}
              {!assignedLoading && !assignedError && assigned.length > 0 && (
                <ul className="space-y-2">
                  {assigned.map((client) => (
                    <ClientListRow
                      key={client.phone}
                      client={client}
                      disabled={isMutating}
                      action={
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                          disabled={isMutating}
                          onClick={() => unassignMutation.mutate(client.phone)}
                        >
                          {unassignMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <UserMinus className="h-3.5 w-3.5" />
                              Desasignar
                            </>
                          )}
                        </Button>
                      }
                    />
                  ))}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="unassigned" className="flex-1 min-h-0 mt-4 flex flex-col gap-3">
            {unassigned.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={allUnassignedSelected}
                    onCheckedChange={toggleAllUnassigned}
                    disabled={isMutating || unassignedLoading}
                  />
                  Seleccionar todos ({unassigned.length})
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    isMutating || selectedUnassigned.size === 0 || assignMutation.isPending
                  }
                  onClick={handleAssignSelected}
                  className="bg-success/90 hover:bg-success text-success-foreground"
                >
                  {assignMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      {assignCountLabel}
                    </>
                  )}
                </Button>
              </div>
            )}
            <ScrollArea className="h-[min(380px,45vh)] pr-3 flex-1">
              {unassignedLoading && (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              {unassignedError && !unassignedLoading && (
                <p className="text-sm text-destructive py-4 text-center">
                  No se pudieron cargar los clientes sin asignar.
                </p>
              )}
              {!unassignedLoading && !unassignedError && unassigned.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No hay clientes sin asesor asignado.
                </p>
              )}
              {!unassignedLoading && !unassignedError && unassigned.length > 0 && (
                <ul className="space-y-2">
                  {unassigned.map((client) => (
                    <ClientListRow
                      key={client.phone}
                      client={client}
                      checked={selectedUnassigned.has(client.phone)}
                      onCheckedChange={() => toggleUnassigned(client.phone)}
                      disabled={isMutating}
                    />
                  ))}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
