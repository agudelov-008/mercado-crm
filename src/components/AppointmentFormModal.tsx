import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  formatOwnerDisplayName,
  normalizeOwnerProfile,
  type SecureClientOwnerProfile,
} from "@/lib/secure-clients";
import {
  APPOINTMENT_HOUR_OPTIONS,
  APPOINTMENT_MINUTE_OPTIONS,
  compileAppointmentIso,
  createAppointment,
  parseAppointmentDateParts,
  updateAppointment,
  type Appointment,
} from "@/lib/appointments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AppointmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientPhone: string;
  clientLabel?: string;
  /** Asesor de cartera; si no se pasa, se resuelve por teléfono al abrir el modal. */
  assignedOwner?: SecureClientOwnerProfile | null;
  appointment?: Appointment | null;
  defaultStartsAt?: Date;
}

const CLIENT_OWNER_SELECT =
  "owner_id, owner:profiles!owner_id(first_name, last_name, email)";

function ClientAssignedPortfolioField({
  owner,
}: {
  owner: SecureClientOwnerProfile | null | undefined;
}) {
  const displayName = formatOwnerDisplayName(owner);
  const isUnassigned = displayName === "Sin asignar";
  const fullName = owner
    ? [owner.first_name, owner.last_name].filter(Boolean).join(" ").trim()
    : "";
  const agentDetail =
    fullName && owner?.email ? `${fullName} / ${owner.email}` : displayName;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-md border px-3 py-2.5 text-sm leading-snug",
        isUnassigned
          ? "border-amber-500/45 bg-amber-500/8 text-amber-100/90"
          : "border-primary/50 bg-primary/8 text-foreground shadow-[0_0_14px_oklch(0.78_0.14_200_/_0.12)]",
      )}
    >
      {isUnassigned ? (
        <span>⚠️ Cartera libre (Sin asignar)</span>
      ) : (
        <span>
          <span aria-hidden className="mr-1">
            💼
          </span>
          Cartera asignada a:{" "}
          <span className="font-medium text-primary">{agentDetail}</span>
        </span>
      )}
    </div>
  );
}

function defaultDateParts(defaultStartsAt?: Date): {
  date: string;
  hour: string;
  minute: string;
} {
  if (defaultStartsAt) {
    const d = new Date(defaultStartsAt);
    d.setHours(9, 0, 0, 0);
    return parseAppointmentDateParts(d.toISOString());
  }
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return parseAppointmentDateParts(now.toISOString());
}

const selectClassName =
  "h-9 w-full rounded-md border border-border bg-surface-elevated px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function AppointmentFormModal({
  open,
  onOpenChange,
  clientPhone,
  clientLabel,
  assignedOwner: assignedOwnerProp,
  appointment,
  defaultStartsAt,
}: AppointmentFormModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = Boolean(appointment);

  const { data: fetchedOwner, isLoading: isLoadingOwner } = useQuery({
    queryKey: ["appointment-client-owner", clientPhone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secure_clients")
        .select(CLIENT_OWNER_SELECT)
        .eq("phone", clientPhone)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return normalizeOwnerProfile(
        (data as { owner?: SecureClientOwnerProfile | SecureClientOwnerProfile[] })
          .owner,
      );
    },
    enabled: open && assignedOwnerProp === undefined && Boolean(clientPhone),
    staleTime: 60_000,
  });

  const assignedOwner =
    assignedOwnerProp !== undefined ? assignedOwnerProp : (fetchedOwner ?? null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [datePart, setDatePart] = useState("");
  const [hourPart, setHourPart] = useState("09");
  const [minutePart, setMinutePart] = useState("00");

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setTitle(appointment.title);
      setDescription(appointment.description ?? "");
      const parts = parseAppointmentDateParts(appointment.starts_at);
      setDatePart(parts.date);
      setHourPart(parts.hour);
      setMinutePart(parts.minute);
      return;
    }
    setTitle("");
    setDescription("");
    const parts = defaultDateParts(defaultStartsAt);
    setDatePart(parts.date);
    setHourPart(parts.hour);
    setMinutePart(parts.minute);
  }, [open, appointment, defaultStartsAt]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("El título es obligatorio.");
      const startsAt = compileAppointmentIso(datePart, hourPart, minutePart);

      if (isEditing && appointment) {
        return updateAppointment(appointment.id, {
          title,
          description,
          starts_at: startsAt,
        });
      }

      return createAppointment({
        client_phone: clientPhone,
        title,
        description,
        starts_at: startsAt,
        created_by: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success(isEditing ? "Cita actualizada." : "Cita agendada correctamente.");
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la cita.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            {isEditing ? "Editar cita" : "Agendar cita"}
          </DialogTitle>
          <DialogDescription>
            {clientLabel
              ? `Cliente: ${clientLabel}`
              : "Completa los datos de la reunión."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoadingOwner && assignedOwnerProp === undefined ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando cartera asignada…
            </p>
          ) : (
            <ClientAssignedPortfolioField owner={assignedOwner} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="appointment-title">Título de la reunión</Label>
            <Input
              id="appointment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Seguimiento de portafolio"
              className="bg-surface-elevated border-border"
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appointment-description">Descripción</Label>
            <Textarea
              id="appointment-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas opcionales para la cita…"
              rows={3}
              className="bg-surface-elevated border-border resize-none"
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha y hora de inicio</Label>
            <Input
              id="appointment-date"
              type="date"
              value={datePart}
              onChange={(e) => setDatePart(e.target.value)}
              className="bg-surface-elevated border-border"
              disabled={mutation.isPending}
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="appointment-hour" className="text-[10px] text-muted-foreground">
                  Hora
                </Label>
                <select
                  id="appointment-hour"
                  value={hourPart}
                  onChange={(e) => setHourPart(e.target.value)}
                  disabled={mutation.isPending}
                  className={cn(selectClassName, "tabular-nums")}
                >
                  {APPOINTMENT_HOUR_OPTIONS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="appointment-minute" className="text-[10px] text-muted-foreground">
                  Minutos
                </Label>
                <select
                  id="appointment-minute"
                  value={minutePart}
                  onChange={(e) => setMinutePart(e.target.value)}
                  disabled={mutation.isPending}
                  className={cn(selectClassName, "tabular-nums")}
                >
                  {APPOINTMENT_MINUTE_OPTIONS.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !datePart}
            className="bg-gradient-primary text-primary-foreground"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEditing ? "Guardar cambios" : "Agendar cita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AppointmentClientPick {
  phone: string;
  first_name: string | null;
  last_name: string | null;
  tp_account: string | null;
  owner_id: string | null;
  owner?: SecureClientOwnerProfile | SecureClientOwnerProfile[] | null;
}

const TP_SEARCH_MIN_LENGTH = 2;
const TP_SEARCH_LIMIT = 10;

function clientDisplayName(client: AppointmentClientPick): string {
  return [client.first_name, client.last_name].filter(Boolean).join(" ").trim();
}

function clientFormLabel(client: AppointmentClientPick): string {
  const name = clientDisplayName(client);
  const tp = client.tp_account?.trim();
  if (tp && name) return `${tp} · ${name}`;
  if (tp) return tp;
  return name || client.phone;
}

interface GlobalAppointmentCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStartsAt?: Date;
}

export function GlobalAppointmentCreateModal({
  open,
  onOpenChange,
  defaultStartsAt,
}: GlobalAppointmentCreateModalProps) {
  const [step, setStep] = useState<"client" | "form">("client");
  const [typedTP, setTypedTP] = useState("");
  const debouncedTP = useDebouncedValue(typedTP, 300);
  const [selectedClient, setSelectedClient] = useState<AppointmentClientPick | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setStep("client");
      setTypedTP("");
      setSelectedClient(null);
    }
  }, [open]);

  const { data: clientMatches = [], isFetching } = useQuery({
    queryKey: ["appointment-client-tp-search", debouncedTP.trim()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secure_clients")
        .select(`phone, first_name, last_name, tp_account, ${CLIENT_OWNER_SELECT}`)
        .ilike("tp_account", `%${debouncedTP.trim()}%`)
        .limit(TP_SEARCH_LIMIT);

      if (error) throw error;
      return (data ?? []) as AppointmentClientPick[];
    },
    enabled: debouncedTP.trim().length >= TP_SEARCH_MIN_LENGTH,
    staleTime: 10_000,
  });

  const showMatchesDropdown =
    debouncedTP.trim().length >= TP_SEARCH_MIN_LENGTH && clientMatches.length > 0;

  if (step === "form" && selectedClient) {
    return (
      <AppointmentFormModal
        open={open}
        onOpenChange={onOpenChange}
        clientPhone={selectedClient.phone}
        clientLabel={clientFormLabel(selectedClient)}
        assignedOwner={normalizeOwnerProfile(selectedClient.owner)}
        defaultStartsAt={defaultStartsAt}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            Nueva cita
          </DialogTitle>
          <DialogDescription>
            Busca al cliente por su código de cuenta TP para asociar la cita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="global-appointment-tp">Cuenta TP (Trader Account)</Label>
          <Input
            id="global-appointment-tp"
            value={typedTP}
            onChange={(e) => {
              setTypedTP(e.target.value);
              setSelectedClient(null);
            }}
            placeholder="Ej. 12345678"
            className="bg-surface-elevated border-border font-mono"
            autoComplete="off"
          />
          {isFetching && debouncedTP.trim().length >= TP_SEARCH_MIN_LENGTH && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Buscando…
            </p>
          )}
          {showMatchesDropdown && (
            <div
              className="rounded-md border border-border bg-surface-elevated overflow-hidden max-h-48 overflow-y-auto"
              role="listbox"
              aria-label="Clientes coincidentes"
            >
              {clientMatches.map((client) => {
                const isSelected = selectedClient?.phone === client.phone;
                const name = clientDisplayName(client);
                return (
                  <button
                    key={client.phone}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedClient(client)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 transition-colors",
                      isSelected
                        ? "bg-primary/15 text-foreground"
                        : "hover:bg-primary/10",
                    )}
                  >
                    <div className="font-mono text-sm font-medium text-primary">
                      {client.tp_account?.trim() || "—"}
                    </div>
                    {name ? (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {name}
                      </div>
                    ) : null}
                    <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-mono truncate">
                      {client.phone}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {typedTP.trim().length >= TP_SEARCH_MIN_LENGTH &&
            !isFetching &&
            clientMatches.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay clientes con esa cuenta TP en tu cartera.
              </p>
            )}
          {selectedClient ? (
            <ClientAssignedPortfolioField
              owner={normalizeOwnerProfile(selectedClient.owner)}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!selectedClient}
            className="bg-gradient-primary text-primary-foreground"
            onClick={() => setStep("form")}
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
