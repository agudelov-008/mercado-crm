import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import {
  appointmentsQueryOptions,
  useAppointmentsRealtime,
} from "@/hooks/use-appointments-realtime";
import {
  canManageAppointments,
  isAppointmentsReadOnly,
} from "@/lib/appointment-rbac";
import {
  buildAppointmentAccess,
  fetchAppointmentsForMonth,
  formatAppointmentTime,
  getAppointmentClientName,
  getAppointmentCreatorName,
  getCalendarDays,
  isSameCalendarDay,
  type Appointment,
} from "@/lib/appointments";
import { AppointmentDetailModal } from "@/components/AppointmentDetailModal";
import { GlobalAppointmentCreateModal } from "@/components/AppointmentFormModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tasks")({ component: CalendarPage });

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function CalendarPage() {
  const { profileRole, affiliateName } = useApp();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAffiliate = profileRole === "Affiliate";
  const canManage = canManageAppointments(profileRole);
  const readOnly = isAppointmentsReadOnly(profileRole);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formDefaultDate, setFormDefaultDate] = useState<Date | undefined>();

  useAppointmentsRealtime();

  const appointmentAccess =
    profileRole && user?.id
      ? buildAppointmentAccess(profileRole, user.id, affiliateName)
      : undefined;

  const appointmentsQueryEnabled =
    profileRole !== null &&
    !!user?.id &&
    !isAuthLoading &&
    (!isAffiliate || !!affiliateName);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: [
      "appointments",
      monthKey(currentMonth),
      profileRole,
      user?.id,
      affiliateName,
    ],
    queryFn: () =>
      fetchAppointmentsForMonth(currentMonth, appointmentAccess),
    enabled: appointmentsQueryEnabled,
    ...appointmentsQueryOptions,
  });

  const calendarDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const date = new Date(appointment.starts_at);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(appointment);
      map.set(key, list);
    }
    return map;
  }, [appointments]);

  const selectedDayAppointments = useMemo(() => {
    const key = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
    return appointmentsByDay.get(key) ?? [];
  }, [appointmentsByDay, selectedDay]);

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function goToPrevMonth() {
    setCurrentMonth(
      (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
    );
  }

  function goToNextMonth() {
    setCurrentMonth(
      (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
    );
  }

  function goToToday() {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now);
  }

  function openAppointmentDetail(appointment: Appointment) {
    setSelectedAppointment(appointment);
    setDetailOpen(true);
  }

  if (profileRole === null) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        Cargando sesión…
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            Calendario
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {readOnly
              ? "Vista de solo lectura — citas de tus clientes asignados."
              : "Agenda de reuniones y seguimientos con clientes."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={goToToday}>
            Hoy
          </Button>
          {canManage && (
            <Button
              type="button"
              size="sm"
              className="bg-gradient-primary text-primary-foreground shadow-glow"
              onClick={() => {
                setFormDefaultDate(selectedDay);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva cita
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-xl border border-border bg-card/40 overflow-hidden shadow-elegant">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-surface">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goToPrevMonth}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-base font-semibold capitalize">{monthLabel}</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goToNextMonth}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-[10px] uppercase tracking-wider text-muted-foreground py-2 font-medium"
                >
                  {label}
                </div>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square bg-surface-elevated rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                  const dayAppointments = appointmentsByDay.get(key) ?? [];
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const isToday = isSameCalendarDay(day, new Date());
                  const isSelected = isSameCalendarDay(day, selectedDay);

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        "aspect-square min-h-[72px] sm:min-h-[88px] rounded-lg border p-1.5 text-left transition-all flex flex-col",
                        isCurrentMonth
                          ? "bg-surface/60 border-border hover:border-primary/40"
                          : "bg-surface/20 border-transparent opacity-40",
                        isToday && "ring-1 ring-primary/50",
                        isSelected && "border-primary/60 bg-primary/10 shadow-glow",
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums w-6 h-6 flex items-center justify-center rounded-full",
                          isToday && "bg-primary text-primary-foreground",
                          isSelected && !isToday && "text-primary",
                        )}
                      >
                        {day.getDate()}
                      </span>
                      <div className="flex-1 mt-0.5 space-y-0.5 overflow-hidden w-full">
                        {dayAppointments.slice(0, 2).map((apt) => (
                          <div
                            key={apt.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              openAppointmentDetail(apt);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                openAppointmentDetail(apt);
                              }
                            }}
                            className="text-[9px] sm:text-[10px] leading-tight px-1 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 truncate cursor-pointer hover:bg-primary/30"
                          >
                            {formatAppointmentTime(apt.starts_at)} {apt.title}
                          </div>
                        ))}
                        {dayAppointments.length > 2 && (
                          <div className="text-[9px] text-muted-foreground px-1">
                            +{dayAppointments.length - 2} más
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-xl border border-border bg-card/40 p-5 flex flex-col min-h-[320px] shadow-elegant">
          <div className="mb-4">
            <h3 className="text-sm font-semibold capitalize">
              {selectedDay.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedDayAppointments.length === 0
                ? "Sin citas programadas"
                : `${selectedDayAppointments.length} cita${selectedDayAppointments.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full bg-surface-elevated rounded-lg" />
              ))
            ) : selectedDayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <CalendarDays className="h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">No hay citas este día.</p>
                {canManage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setFormDefaultDate(selectedDay);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Agendar cita
                  </Button>
                )}
              </div>
            ) : (
              selectedDayAppointments.map((apt) => {
                const creatorName = getAppointmentCreatorName(apt);
                return (
                <button
                  key={apt.id}
                  type="button"
                  onClick={() => openAppointmentDetail(apt)}
                  className="w-full text-left rounded-lg border border-border bg-gradient-surface p-3 hover:border-primary/40 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{apt.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {formatAppointmentTime(apt.starts_at)}
                      </div>
                      <div className="text-xs text-primary/80 mt-1 truncate">
                        {getAppointmentClientName(apt)}
                      </div>
                      {creatorName && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          Creado por: {creatorName}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
                );
              })
            )}
          </div>
        </aside>
      </div>

      <AppointmentDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appointment={selectedAppointment}
        canManage={canManage}
      />

      {canManage && (
        <GlobalAppointmentCreateModal
          open={formOpen}
          onOpenChange={setFormOpen}
          defaultStartsAt={formDefaultDate}
        />
      )}
    </div>
  );
}
