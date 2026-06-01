import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import {

  ArrowLeft,

  Building2,

  Calendar,

  Globe,

  Loader2,

  Mail,

  Phone,

  User,

} from "lucide-react";

import { toast } from "sonner";

import type { Client } from "@/lib/mock-data";

import { useApp } from "@/lib/app-context";

import {

  fetchSecureClientByPhone,

  formatClientDate,

  formatOwnerDisplayName,

  phoneFromClientDetailId,

  updateClientOwner,

  type SecureClient,

  type SecureClientDetail,

} from "@/lib/secure-clients";

import { fetchAgentsForOwnerSelect } from "@/lib/user-management";

import { CallModal } from "@/components/CallModal";

import { ClientActivityPanel } from "@/components/ClientActivityPanel";

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



export const Route = createFileRoute("/clients/$id")({ component: ClientDetail });



const NONE_OWNER = "__none__";



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

    netWorthBracket: row.country ?? "",

    kyc: "Pending",

    interests: [],

    assignedAgent: row.affiliate ?? "",

    lastContact: row.last_contacted ?? "",

    avatarColor: "#10b981",

  };

}



function DetailField({

  label,

  value,

  mono,

}: {

  label: string;

  value: string;

  mono?: boolean;

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

        )}

      >

        {value}

      </div>

    </div>

  );

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



function ClientDetail() {

  const { id } = Route.useParams();

  const { profileRole } = useApp();

  const navigate = useNavigate();

  const phone = phoneFromClientDetailId(id);

  const [callOpen, setCallOpen] = useState(false);



  const canAssignOwner =

    profileRole === "Admin" || profileRole === "Manager";

  const isAffiliate = profileRole === "Affiliate";

  const isAgent = profileRole === "Agent";



  const {

    data: client,

    isLoading,

    isError,

    error,

  } = useQuery({

    queryKey: ["secure-client", phone],

    queryFn: () => fetchSecureClientByPhone(phone),

    staleTime: 30_000,

  });



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

    client.phone;

  const initials =

    displayName

      .split(" ")

      .filter(Boolean)

      .slice(0, 2)

      .map((part) => part[0]?.toUpperCase() ?? "")

      .join("") || "?";

  const modalClient = secureClientToModalClient(client);



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

                        leadStatusStyles[client.lead_status] ??

                          "bg-muted/30 text-muted-foreground border-border",

                      )}

                    >

                      {client.lead_status}

                    </span>

                  )}

                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground mt-2">

                  <span className="flex items-center gap-1.5">

                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                    {client.email ?? "—"}

                  </span>

                  <span className="flex items-center gap-1.5">

                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                    {client.phone}

                  </span>

                  {client.country && (

                    <span className="flex items-center gap-1.5">

                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                      {client.country}

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

                    Cliente asignado a tu cartera — historial de actividad completo.

                  </p>

                )}

              </div>

              <div className="flex gap-2">

                <button

                  type="button"

                  onClick={() => setCallOpen(true)}

                  className="h-10 px-4 rounded-md bg-success/15 hover:bg-success/25 text-success border border-success/30 flex items-center gap-2 text-sm font-medium"

                >

                  <Phone className="h-4 w-4" /> Llamar

                </button>

              </div>

            </div>

          </div>



          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            <DetailField label="First Name" value={client.first_name ?? "—"} />

            <DetailField label="Last Name" value={client.last_name ?? "—"} />

            <DetailField label="Country" value={client.country ?? "—"} />

            <DetailField label="Affiliate" value={client.affiliate ?? "—"} />

            <DetailField label="TP Account" value={client.tp_account ?? "—"} mono />

            <DetailField label="Phone" value={client.phone} mono />

            <DetailField label="Email" value={client.email ?? "—"} />

            <DetailField label="Lead Status" value={client.lead_status ?? "—"} />

            <OwnerAssignmentField
              client={client}
              canAssign={canAssignOwner}
              isClientLoading={isLoading}
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

              value={formatClientDate(client.last_assignment)}

            />

            <DetailField

              label="Last Contacted"

              value={formatClientDate(client.last_contacted)}

            />

            <DetailField

              label="Updated At"

              value={formatClientDate(client.updated_at)}

            />

          </div>



          <div className="rounded-xl border border-border bg-card/40 p-5">

            <h2 className="text-sm font-semibold flex items-center gap-2">

              <User className="h-4 w-4" /> Información de contacto

            </h2>

            <p className="text-xs text-muted-foreground mt-1">

              Datos visibles según tu rol y políticas de acceso en Supabase.

            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">

                <Phone className="h-4 w-4 text-success mt-0.5" />

                <div>

                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">

                    Teléfono

                  </div>

                  <div className="text-sm font-mono mt-0.5">{client.phone}</div>

                </div>

              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface border border-border">

                <Mail className="h-4 w-4 text-info mt-0.5" />

                <div>

                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">

                    Correo

                  </div>

                  <div className="text-sm mt-0.5 break-all">{client.email ?? "—"}</div>

                </div>

              </div>

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



          <div className="rounded-xl border border-border bg-card/40 p-5 flex items-center gap-3 text-xs text-muted-foreground">

            <Calendar className="h-4 w-4 shrink-0" />

            <span>

              Última actualización: {formatClientDate(client.updated_at)} · Último

              contacto: {formatClientDate(client.last_contacted)}

            </span>

          </div>

        </div>



        <ClientActivityPanel
          clientPhone={client.phone}
          className="lg:min-h-[520px]"
        />

      </div>



      <CallModal open={callOpen} onOpenChange={setCallOpen} client={modalClient} />

    </div>

  );

}

