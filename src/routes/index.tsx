import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Phone,
  Users,
  Trophy,
  Clock,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { ClientCard } from "@/components/ClientCard";
import { CallModal } from "@/components/CallModal";
import { openWhatsAppChat } from "@/lib/whatsapp";
import type { Client } from "@/lib/mock-data";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import {
  fetchAppointmentsForDay,
  formatAppointmentTime12h,
  getAppointmentClientName,
} from "@/lib/appointments";
import {
  fetchDashboardMetrics,
  fetchPriorityClients,
  formatTotalCalls,
  priorityClientOwnerLabel,
} from "@/lib/dashboard";
import { appointmentsQueryOptions } from "@/hooks/use-appointments-realtime";
import {
  clientDetailIdFromPhone,
  formatClientDate,
  type SecureClientWithOwners,
} from "@/lib/secure-clients";
import { canMessageClients } from "@/lib/role-rbac";

export const Route = createFileRoute("/")({ component: Dashboard });

const AVATAR_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
];

function avatarColorForPhone(phone: string): string {
  let hash = 0;
  for (let i = 0; i < phone.length; i += 1) {
    hash = phone.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function secureClientToCardClient(row: SecureClientWithOwners): Client {
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
    assignedAgent: priorityClientOwnerLabel(row),
    lastContact: row.last_contacted
      ? formatClientDate(row.last_contacted)
      : "—",
    avatarColor: avatarColorForPhone(row.phone),
  };
}

function Dashboard() {
  const { currentUser, profileRole } = useApp();
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [callClient, setCallClient] = useState<Client | null>(null);

  const isProfileReady = !!user?.id && profileRole !== null && !isAuthLoading;
  const canMessage = canMessageClients(profileRole);

  const {
    data: metrics,
    isPending: metricsPending,
    isFetching: metricsFetching,
    isError: metricsError,
  } = useQuery({
    queryKey: ["dashboard-metrics", user?.id],
    queryFn: fetchDashboardMetrics,
    enabled: isProfileReady,
    staleTime: 30_000,
  });

  const {
    data: todayAppointments = [],
    isPending: appointmentsPending,
    isFetching: appointmentsFetching,
  } = useQuery({
    queryKey: ["appointments", "today"],
    queryFn: () => fetchAppointmentsForDay(new Date()),
    enabled: isProfileReady,
    ...appointmentsQueryOptions,
  });

  const {
    data: priorityClients = [],
    isPending: priorityPending,
    isFetching: priorityFetching,
  } = useQuery({
    queryKey: ["dashboard-priority-clients", user?.id],
    queryFn: () => fetchPriorityClients(6),
    enabled: isProfileReady,
    staleTime: 30_000,
  });

  const priority = useMemo(
    () => priorityClients.map(secureClientToCardClient),
    [priorityClients],
  );

  const isLoadingMetrics = !isProfileReady || metricsPending || metricsFetching;
  const isLoadingAppointments =
    !isProfileReady || appointmentsPending || appointmentsFetching;
  const isLoadingPriority =
    !isProfileReady || priorityPending || priorityFetching;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Welcome back
          </div>
          <h1 className="text-2xl font-semibold mt-1">
            {currentUser.name.split(" ")[0]} · Trading Floor Overview
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-success/10 border border-success/30 text-success">
          <ArrowUpRight className="h-3.5 w-3.5" /> Portfolio up +1.84% today
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Marcación Total"
          value={
            isLoadingMetrics
              ? "—"
              : metricsError
                ? "—"
                : formatTotalCalls(metrics?.totalCalls ?? 0)
          }
          delta="Llamadas acumuladas"
          icon={Phone}
          accent="success"
        />
        <MetricCard
          label="Active Leads"
          value={
            isLoadingMetrics
              ? "—"
              : metricsError
                ? "—"
                : String(metrics?.activeLeads ?? 0)
          }
          delta={
            isLoadingMetrics || metricsError
              ? undefined
              : `${metrics?.totalClients ?? 0} en cartera`
          }
          up
          icon={Users}
          accent="info"
        />
        <MetricCard
          label="Closed Deals · Win Rate"
          value={
            isLoadingMetrics
              ? "—"
              : metricsError
                ? "—"
                : `${metrics?.ftdRate ?? 0}% FTD Rate`
          }
          delta={
            isLoadingMetrics || metricsError
              ? undefined
              : `${metrics?.ftdCount ?? 0} FTD · ${metrics?.totalClients ?? 0} total`
          }
          up={(metrics?.ftdRate ?? 0) > 0}
          icon={Trophy}
          accent="primary"
        />
        <MetricCard
          label="Pending Follow-ups"
          value={
            isLoadingMetrics
              ? "—"
              : metricsError
                ? "—"
                : String(metrics?.pendingFollowups ?? 0)
          }
          delta={
            isLoadingMetrics || metricsError
              ? undefined
              : "Call Again · Follow-Up"
          }
          icon={Clock}
          accent="warning"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl border border-border bg-card/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Priority Client Feed</h2>
              <p className="text-xs text-muted-foreground">
                High-touch accounts assigned to you
              </p>
            </div>
            <button
              onClick={() => navigate({ to: "/clients" })}
              className="text-xs text-primary hover:underline"
            >
              View all →
            </button>
          </div>
          <div className="space-y-2.5">
            {isLoadingPriority && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Cargando clientes…
              </div>
            )}
            {!isLoadingPriority && priority.length === 0 && (
              <div className="rounded-lg border border-border bg-surface-elevated/40 px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No hay clientes prioritarios en tu cartera.
                </p>
              </div>
            )}
            {!isLoadingPriority &&
              priority.map((c) => (
                <ClientCard
                  key={c.id}
                  client={c}
                  showMessageButton={canMessage}
                  onCall={() => setCallClient(c)}
                  onMessage={() => openWhatsAppChat(c.phone)}
                  onOpen={() =>
                    navigate({
                      to: "/clients/$id",
                      params: { id: clientDetailIdFromPhone(c.phone) },
                    })
                  }
                />
              ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-gradient-surface p-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">Citas del Día</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Today&apos;s Schedule
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {isLoadingAppointments && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-xs">Cargando agenda…</span>
                </div>
              )}
              {!isLoadingAppointments && todayAppointments.length === 0 && (
                <div className="rounded-md bg-surface-elevated border border-border px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    No hay citas agendadas para hoy
                  </p>
                </div>
              )}
              {!isLoadingAppointments &&
                todayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-start gap-3 p-2.5 rounded-md bg-surface-elevated border border-border"
                  >
                    <span className="text-xs font-semibold tabular-nums text-primary shrink-0 pt-0.5 min-w-[72px]">
                      {formatAppointmentTime12h(appointment.starts_at)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">
                        {appointment.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {getAppointmentClientName(appointment)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-gradient-surface p-5">
            <h3 className="text-sm font-semibold">Distribución de Leads</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLoadingMetrics
                ? "Calculando…"
                : `${metrics?.totalClients ?? 0} clientes en cartera`}
            </p>
            <div className="mt-4 space-y-2.5">
              {isLoadingMetrics && (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {!isLoadingMetrics &&
                (metrics?.leadDistribution ?? []).map((item) => (
                  <div key={item.status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{item.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {item.percentage}%
                        <span className="ml-1.5 text-[10px] opacity-70">
                          ({item.count})
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.percentage}%`,
                          background: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <CallModal
        open={!!callClient}
        onOpenChange={(o) => !o && setCallClient(null)}
        client={callClient}
      />
    </div>
  );
}
