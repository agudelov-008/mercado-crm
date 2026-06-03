import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
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
  appointment?: Appointment | null;
  defaultStartsAt?: Date;
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
  appointment,
  defaultStartsAt,
}: AppointmentFormModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = Boolean(appointment);

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
  const [step, setStep] = useState<"phone" | "form">("phone");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("phone");
      setPhone("");
    }
  }, [open]);

  if (step === "form" && phone.trim()) {
    return (
      <AppointmentFormModal
        open={open}
        onOpenChange={onOpenChange}
        clientPhone={phone.trim()}
        defaultStartsAt={defaultStartsAt}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Nueva cita
          </DialogTitle>
          <DialogDescription>
            Ingresa el teléfono del cliente para asociar la cita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="global-appointment-phone">Teléfono del cliente</Label>
          <Input
            id="global-appointment-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+57 300 000 0000"
            className="bg-surface-elevated border-border font-mono"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!phone.trim()}
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
