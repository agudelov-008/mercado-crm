import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  appointmentsQueryOptions,
  useAppointmentsRealtime,
} from "@/hooks/use-appointments-realtime";
import { useApp } from "@/lib/app-context";
import {
  canManageAppointments,
  isAppointmentsReadOnly,
} from "@/lib/appointment-rbac";
import {
  type AppointmentAccess,
  fetchAppointmentsByPhone,
  formatAppointmentDateTime,
  formatAppointmentTime,
  type Appointment,
} from "@/lib/appointments";
import { AppointmentDetailModal } from "@/components/AppointmentDetailModal";
import { AppointmentFormModal } from "@/components/AppointmentFormModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ClientAppointmentsSectionProps {
  clientPhone: string;
  clientLabel: string;
  access?: AppointmentAccess;
  className?: string;
}

export function ClientAppointmentsSection({
  clientPhone,
  clientLabel,
  access,
  className,
}: ClientAppointmentsSectionProps) {
  const { profileRole } = useApp();
  const canManage = canManageAppointments(profileRole);
  const readOnly = isAppointmentsReadOnly(profileRole);

  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useAppointmentsRealtime();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", "client", clientPhone, access],
    queryFn: () => fetchAppointmentsByPhone(clientPhone, access),
    enabled: clientPhone.length > 0,
    ...appointmentsQueryOptions,
  });

  const upcoming = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((a) => new Date(a.starts_at).getTime() >= now - 60 * 60 * 1000)
      .slice(0, 5);
  }, [appointments]);

  const pastCount = appointments.length - upcoming.length;

  return (
    <>
      <div
        className={cn(
          "rounded-xl border border-border bg-card/40 p-5 space-y-4",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Agenda del cliente
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {readOnly
                ? "Vista de solo lectura — citas programadas para este cliente."
                : "Próximas reuniones y seguimientos agendados."}
            </p>
          </div>
          {canManage && (
            <Button
              type="button"
              size="sm"
              onClick={() => setFormOpen(true)}
              className="bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Agendar cita
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full bg-surface-elevated" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/50 p-6 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay citas próximas para este cliente.
            </p>
            {canManage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setFormOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Agendar primera cita
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((appointment) => (
              <li key={appointment.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(appointment);
                    setDetailOpen(true);
                  }}
                  className="w-full text-left rounded-lg border border-border bg-gradient-surface p-3 hover:border-primary/40 transition-all group flex items-center gap-3"
                >
                  <div className="shrink-0 h-10 w-10 rounded-md bg-primary/15 border border-primary/25 flex flex-col items-center justify-center">
                    <span className="text-[10px] uppercase text-primary font-semibold leading-none">
                      {new Date(appointment.starts_at).toLocaleDateString(undefined, {
                        month: "short",
                      })}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-primary leading-none mt-0.5">
                      {new Date(appointment.starts_at).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {appointment.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span className="tabular-nums">
                        {formatAppointmentTime(appointment.starts_at)}
                      </span>
                      <span>·</span>
                      <span className="truncate">
                        {formatAppointmentDateTime(appointment.starts_at)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && pastCount > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {pastCount} cita{pastCount !== 1 ? "s" : ""} anterior
            {pastCount !== 1 ? "es" : ""} en el historial
          </p>
        )}
      </div>

      {canManage && (
        <AppointmentFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          clientPhone={clientPhone}
          clientLabel={clientLabel}
        />
      )}

      <AppointmentDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appointment={selected}
        canManage={canManage}
      />
    </>
  );
}
