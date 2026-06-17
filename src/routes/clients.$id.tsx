import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Globe,
  Loader2,
  Mail,
  Pencil,
  Phone,
  User,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import {
  bulkUpdateLeadStatus,
  fetchSecureClientByPhone,
  formatClientDate,
  formatClientDateTime,
  formatLastContacted,
  formatOwnerDisplayName,
  LEAD_STATUS_BADGE_STYLES,
  LEAD_STATUS_OPTIONS,
  normalizeLeadStatus,
  clientDetailIdFromPhone,
  phoneFromClientDetailId,
  updateClientOwner,
  type LeadStatus,
  type SecureClientDetail,
} from "@/lib/secure-clients";
import { fetchAgentsForOwnerSelect } from "@/lib/user-management";
import { CountryDisplay } from "@/lib/country-flags";
import {
  canAssignClients,
  canEditClientProfile,
  canInitiateClientCall,
  canMessageClients,
  canUpdateClientLeadStatus,
  canViewClientContactInUi,
} from "@/lib/role-rbac";
import { useClientCall } from "@/hooks/use-client-call";
import { fetchActivityLogsByPhone } from "@/lib/activity-logs";
import { buildAppointmentAccess } from "@/lib/appointments";
import { ClientEditModal } from "@/components/ClientEditModal";
import { ClientActivityPanel } from "@/components/ClientActivityPanel";
import { ClientAppointmentsSection } from "@/components/ClientAppointmentsSection";
import { MaskedContactText } from "@/components/MaskedContactText";
import { WhatsAppActionButton } from "@/components/WhatsAppActionButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ProfileAgentOption } from "@/lib/user-management";

export const Route = createFileRoute("/clients/$id")({
  component: ClientDetail,
  validateSearch: z
    .object({
      edit: z.enum(["1", "true"]).optional(),
      search: z.string().optional(),
      q: z.string().optional(),
    })
    .strip(),
});

const NONE_OWNER = "__none__";

function DetailField({
  label,
  value,
  mono,
  masked,
}: {
  label: string;
  value: string;
  mono?: boolean;
  masked?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg bg-surface border border-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-medium mt-1 break-all",
          mono && "tabular-nums font-mono",
          masked && "select-none",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ContactDetailField({
  label,
  kind,
  value,
  unmasked,
}: {
  label: string;
  kind: "phone" | "email";
  value: string | null | undefined;
  unmasked?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg bg-surface border border-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium mt-1 break-all">
        {unmasked ? (
          <span className={cn(kind === "phone" && "font-mono tabular-nums")}>{value ?? "—"}</span>
        ) : (
          <MaskedContactText kind={kind} value={value} mono={kind === "phone"} />
        )}
      </div>
    </div>
  );
}

function resolvePreviousOwnerLabel(client: SecureClientDetail): string {
  return formatOwnerDisplayName(client.previous_owner);
}

function resolveOwnerLabel(
  client: SecureClientDetail,
  agents: ProfileAgentOption[],
): string {
  const fromProfile = formatOwnerDisplayName(client.owner);
  if (fromProfile !== "Sin asignar") return fromProfile;
  if (!client.owner_id) return "Sin asignar";
  return agents.find((a) => a.id === client.owner_id)?.label ?? "Sin asignar";
}

function LeadStatusField({
  client,
  canEdit,
}: {
  client: SecureClientDetail;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const phone = client.phone;

  const statusMutation = useMutation({
    mutationFn: (leadStatus: LeadStatus) =>
      bulkUpdateLeadStatus([phone], leadStatus),
    onSuccess: () => {
      toast.success("Estado del cliente actualizado.");
      void queryClient.invalidateQueries({ queryKey: ["secure-client", phone] });
      void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "No se pudo actualizar el estado.",
      );
    },
  });

  const current = client.lead_status ?? "—";

  if (!canEdit) {
    return <DetailField label="Lead Status" value={current} />;
  }

  return (
    <div className="p-3 rounded-lg bg-surface border border-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Lead Status
      </div>
      <Select
        value={normalizeLeadStatus(String(client.lead_status ?? "New"))}
        disabled={statusMutation.isPending}
        onValueChange={(v) => {
          const next = normalizeLeadStatus(v, { strict: true });
          if (next === client.lead_status) return;
          statusMutation.mutate(next);
        }}
      >
        <SelectTrigger className="mt-1.5 h-9 bg-surface-elevated border-border text-sm">
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
      {statusMutation.isPending && (
        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Guardando…
        </p>
      )}
    </div>
  );
}

function OwnerAssignmentField({
  client,
  canAssign,
  isClientLoading,
}: {
  client: SecureClientDetail;
  canAssign: boolean;
  isClientLoading?: boolean;
}) {
  const queryClient = useQueryClient();
  const phone = client.phone;

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agent-profiles-owner"],
    queryFn: fetchAgentsForOwnerSelect,
    enabled: canAssign,
    staleTime: 60_000,
  });

  const assignMutation = useMutation({
    mutationFn: (ownerId: string | null) => updateClientOwner(phone, ownerId),
    onSuccess: (_data, ownerId) => {
      toast.success(
        ownerId ? "Asesor asignado correctamente." : "Asesor desasignado.",
      );
      void queryClient.invalidateQueries({
        queryKey: ["secure-client", client.phone],
      });
      void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "No se pudo asignar el asesor.",
      );
    },
  });

  const ownerLabel = resolveOwnerLabel(client, agents);
  const showOwnerSkeleton =
    isClientLoading || (Boolean(client.owner_id) && !client.owner && agentsLoading);

  if (!canAssign) {
    if (showOwnerSkeleton) {
      return (
        <div className="p-3 rounded-lg bg-surface border border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Owner (Asesor)
          </div>
          <Skeleton className="h-5 w-36 mt-1.5 bg-surface-elevated" />
        </div>
      );
    }
    return <DetailField label="Owner (Asesor)" value={ownerLabel} />;
  }

  return (
    <div className="p-3 rounded-lg bg-surface border border-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Owner (Asesor)
      </div>
      <Select
        value={client.owner_id ?? NONE_OWNER}
        disabled={assignMutation.isPending || agentsLoading}
        onValueChange={(value) => {
          const ownerId = value === NONE_OWNER ? null : value;
          if (ownerId === client.owner_id) return;
          assignMutation.mutate(ownerId);
        }}
      >
        <SelectTrigger className="mt-1.5 h-9 bg-surface-elevated border-border text-sm">
          <SelectValue placeholder="Sin asignar">
            {showOwnerSkeleton ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cargando…
              </span>
            ) : (
              ownerLabel
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_OWNER}>Sin asignar</SelectItem>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {assignMutation.isPending && (
        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Guardando asignación…
        </p>
      )}
    </div>
  );
}

export function ClientDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { profileRole, affiliateName } = useApp();
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const phone = phoneFromClientDetailId(id);
  const [editOpen, setEditOpen] = useState(false);
  const isProfileReady = !!user?.id && profileRole !== null && !isAuthLoading;

  const isAffiliate = profileRole === "Affiliate";
  const canViewContact = canViewClientContactInUi(profileRole);
  const canAssign = canAssignClients(profileRole);
  const canEditProfile = canEditClientProfile(profileRole);
  const canEditStatus = canUpdateClientLeadStatus(profileRole);
  const canOpenWhatsApp = canMessageClients(profileRole);
  const canCall = canInitiateClientCall(profileRole);
  const isAgent = profileRole === "Agent";
  const { callClient } = useClientCall();
  const isAssistant = profileRole === "Assistant";

  const scopedAccess =
    profileRole && user?.id
      ? {
        appointments: buildAppointmentAccess(profileRole, user.id, affiliateName),
      }
      : null;

  const {
    data: client,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["secure-client", phone, user?.id],
    queryFn: () => fetchSecureClientByPhone(phone),
    enabled: isProfileReady && phone.length > 0,
    refetchOnMount: true,
    staleTime: 30_000,
  });

  const activityPhone = phone;

  const {
    data: activityLogs = [],
    isPending: isActivityLogsPending,
    isError: isActivityLogsError,
    error: activityLogsError,
  } = useQuery({
    queryKey: ["activity-logs", activityPhone, user?.id, profileRole, affiliateName],
    queryFn: () => fetchActivityLogsByPhone(activityPhone),
    enabled: isProfileReady && activityPhone.length > 0,
    refetchOnMount: true,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!canEditProfile || !search.edit || !client) return;
    setEditOpen(true);
    navigate({
      to: "/clients/$id",
      params: { id },
      search: () => ({}),
      replace: true,
    });
  }, [canEditProfile, search.edit, client, id, navigate]);

  if (!isProfileReady) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        Cargando sesión…
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        Cargando cliente…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Error al cargar el cliente."}
        </p>
        <Link to="/clients" className="text-primary hover:underline text-sm">
          Volver a clientes
        </Link>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 space-y-3">
        <p>Cliente no encontrado.</p>
        <Link to="/clients" className="text-primary hover:underline text-sm">
          Volver a clientes
        </Link>
      </div>
    );
  }

  const displayName =
    [client.first_name, client.last_name].filter(Boolean).join(" ").trim() ||
    (canViewContact ? client.phone : "Cliente");
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 min-h-0">
      <button
        type="button"
        onClick={() => navigate({ to: "/clients" })}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a clientes
      </button>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        <div className="w-full lg:w-[44%] xl:w-[40%] flex flex-col gap-6 shrink-0">
          <div className="rounded-xl border border-border bg-gradient-surface p-6 shadow-elegant">
            <div className="flex items-start gap-5 flex-wrap">
              <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-semibold text-white bg-gradient-primary">
                {initials}
              </div>
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold">{displayName}</h1>
                  {client.lead_status && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border",
                        LEAD_STATUS_BADGE_STYLES[
                        client.lead_status as LeadStatus
                        ] ??
                        "bg-muted/30 text-muted-foreground border-border",
                      )}
                    >
                      {client.lead_status}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground mt-2">
                  {canViewContact && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {isAffiliate ? <span>{client.email}</span> : <MaskedContactText kind="email" value={client.email} />}
                    </span>
                  )}
                  {canViewContact && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {isAffiliate ? <span className="font-mono tabular-nums">{client.phone}</span> : <MaskedContactText kind="phone" value={client.phone} mono />}
                    </span>
                  )}
                  {client.country && (
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <CountryDisplay country={client.country} />
                    </span>
                  )}
                </div>
                {isAffiliate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Vista completa de contacto — tus registros asignados.
                  </p>
                )}
                {isAgent && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Sin acceso a teléfono ni correo. Puedes llamar, cambiar estado y
                    registrar notas.
                  </p>
                )}
                {isAssistant && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Puedes ver contacto completo, llamar, cambiar estado y registrar
                    notas. La exportación a Excel no incluye teléfono ni correo.
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {canEditProfile && (
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="h-10 px-4 rounded-md bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 flex items-center gap-2 text-sm font-medium"
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                )}
                {canCall && (
                  <button
                    type="button"
                    onClick={() => void callClient(phone)}
                    className="h-10 px-4 rounded-md bg-success/15 hover:bg-success/25 text-success border border-success/30 flex items-center gap-2 text-sm font-medium"
                  >
                    <Phone className="h-4 w-4" /> Call Primary
                  </button>
                )}
                {canOpenWhatsApp && (
                  <WhatsAppActionButton phone={phone} />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DetailField label="First Name" value={client.first_name ?? "—"} />
            <DetailField label="Last Name" value={client.last_name ?? "—"} />
            <div className="p-3 rounded-lg bg-surface border border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Country
              </div>
              <div className="text-sm font-medium mt-1">
                <CountryDisplay country={client.country} />
              </div>
            </div>
            <DetailField label="Affiliate" value={client.affiliate ?? "—"} />
            <DetailField label="TP Account" value={client.tp_account ?? "—"} mono />
            {canViewContact && (
              <ContactDetailField label="Phone" kind="phone" value={client.phone} unmasked={isAffiliate} />
            )}
            {canViewContact && (
              <ContactDetailField label="Email" kind="email" value={client.email} unmasked={isAffiliate} />
            )}
            <LeadStatusField client={client} canEdit={canEditStatus} />
            <OwnerAssignmentField
              client={client}
              canAssign={canAssign}
              isClientLoading={isLoading}
            />
            <DetailField
              label="Previous Owner"
              value={resolvePreviousOwnerLabel(client)}
            />
            <DetailField
              label="Total Calls"
              value={
                client.total_calls === null || client.total_calls === undefined
                  ? "—"
                  : String(client.total_calls)
              }
              mono
            />
            <DetailField
              label="Created On"
              value={formatClientDate(client.created_on)}
            />
            <DetailField
              label="Last Assignment"
              value={formatClientDateTime(client.last_assignment)}
            />
            <DetailField
              label="Last Contacted"
              value={formatLastContacted(client.last_contacted)}
            />
            <DetailField
              label="Updated At"
              value={formatClientDate(client.updated_at)}
            />
          </div>

          {(canViewContact || client.affiliate) && (
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4" /> Información de contacto
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {isAffiliate
                  ? "Datos visibles para tu rol de afiliadora."
                  : "Datos visibles según tu rol y políticas de acceso en Supabase."}
              </p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {canViewContact && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">
                    <Phone className="h-4 w-4 text-success mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Teléfono
                      </div>
                      <div className="text-sm font-mono mt-0.5">
                        {isAffiliate ? <span>{client.phone}</span> : <MaskedContactText kind="phone" value={client.phone} mono />}
                      </div>
                    </div>
                  </div>
                )}
                {canViewContact && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">
                    <Mail className="h-4 w-4 text-info mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Correo
                      </div>
                      <div className="text-sm mt-0.5 break-all">
                        {isAffiliate ? <span>{client.email}</span> : <MaskedContactText kind="email" value={client.email} />}
                      </div>
                    </div>
                  </div>
                )}
                {client.affiliate && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border sm:col-span-2">
                    <Building2 className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Afiliadora
                      </div>
                      <div className="text-sm mt-0.5">{client.affiliate}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isAffiliate && (
            <ClientAppointmentsSection
              clientPhone={phone}
              clientLabel={displayName}
              access={scopedAccess?.appointments}
            />
          )}

          <div className="rounded-xl border border-border bg-card/40 p-5 flex items-center gap-3 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              Última actualización: {formatClientDate(client.updated_at)} · Último
              contacto: {formatLastContacted(client.last_contacted)}
            </span>
          </div>
        </div>

        <ClientActivityPanel
          clientPhone={client.phone}
          className="flex-1 min-h-[520px] lg:min-h-[520px] w-full"
          activitiesQuery={{
            activities: activityLogs,
            isPending: isActivityLogsPending,
            isError: isActivityLogsError,
            error: activityLogsError,
          }}
        />
      </div>

      {canEditProfile && (
        <ClientEditModal
          client={client}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={({ phone: newPhone, phoneChanged }) => {
            if (!phoneChanged) return;
            navigate({
              to: "/clients/$id",
              params: { id: clientDetailIdFromPhone(newPhone) },
              search: () => ({}),
              replace: true,
            });
          }}
        />
      )}
    </div>
  );
}
