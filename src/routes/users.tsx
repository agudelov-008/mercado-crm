import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Briefcase,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Plus,
  Shield,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-context";
import { canAccessUserManagement, getProfileRoleLabel } from "@/lib/role-rbac";
import {
  countClientsByOwnerIds,
  createAgentWithUser,
  deleteAgentProfile,
  fetchAgentProfiles,
  updateAgentProfile,
  type AgentFormInput,
  type AgentUpdateInput,
  type ProvisionableTeamRole,
  type TeamProfile,
} from "@/lib/user-management";
import { AgentPortfolioModal } from "@/components/AgentPortfolioModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/users")({ component: UsersPage });

const AGENTS_QUERY_KEY = ["team-agents"] as const;

const EMPTY_CREATE: AgentFormInput = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "Agent",
};

const CREATE_ROLE_OPTIONS: { value: ProvisionableTeamRole; label: string }[] = [
  { value: "Agent", label: "Asesor" },
  { value: "Manager", label: "CRM" },
  { value: "Assistant", label: "Asistente" },
];

function profileName(row: TeamProfile): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || row.email;
}

function profileInitials(row: TeamProfile): string {
  return profileName(row)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function agentToUpdateForm(agent: TeamProfile): AgentUpdateInput {
  return {
    firstName: agent.first_name?.trim() ?? "",
    lastName: agent.last_name?.trim() ?? "",
    email: agent.email,
    password: "",
  };
}

async function fetchAgentsWithCounts(): Promise<
  Array<TeamProfile & { clientCount: number }>
> {
  const agents = await fetchAgentProfiles();
  const counts = await countClientsByOwnerIds(agents.map((a) => a.id));
  return agents.map((agent) => ({
    ...agent,
    clientCount: counts.get(agent.id) ?? 0,
  }));
}

function AccessDenied() {
  return (
    <div className="p-8 max-w-md mx-auto mt-20 text-center">
      <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
      <h2 className="text-xl font-semibold mt-4">Acceso restringido</h2>
      <p className="text-sm text-muted-foreground mt-2">
        La gestión de usuarios está reservada para administradores del sistema.
      </p>
      <Button className="mt-4" asChild>
        <Link to="/">Volver al Dashboard</Link>
      </Button>
    </div>
  );
}

function UsersPage() {
  const { profileRole } = useApp();

  if (profileRole === null) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!canAccessUserManagement(profileRole)) {
    return <AccessDenied />;
  }

  return <UsersCrud />;
}

function UsersCrud() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AgentFormInput>(EMPTY_CREATE);
  const [editAgent, setEditAgent] = useState<TeamProfile | null>(null);
  const [editForm, setEditForm] = useState<AgentUpdateInput>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<TeamProfile | null>(null);
  const [portfolioAgent, setPortfolioAgent] = useState<TeamProfile | null>(null);

  const { data: agents = [], isLoading, isError, error } = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: fetchAgentsWithCounts,
    staleTime: 30_000,
  });

  const invalidateAgentQueries = () => {
    void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["agent-profiles-owner"] });
    void queryClient.invalidateQueries({ queryKey: ["agent-profiles-manual"] });
    void queryClient.invalidateQueries({ queryKey: ["agent-profiles-bulk-assign"] });
    void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
  };

  const createMutation = useMutation({
    mutationFn: () => createAgentWithUser(createForm),
    onSuccess: () => {
      toast.success("Miembro del equipo y cuenta de acceso creados correctamente.");
      setCreateForm(EMPTY_CREATE);
      setCreateOpen(false);
      invalidateAgentQueries();
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el miembro del equipo.",
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editAgent) throw new Error("No hay asesor seleccionado.");
      return updateAgentProfile(editAgent.id, editForm);
    },
    onSuccess: () => {
      toast.success("Asesor actualizado correctamente.");
      setEditAgent(null);
      invalidateAgentQueries();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al actualizar el asesor.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (agentId: string) => deleteAgentProfile(agentId),
    onSuccess: () => {
      toast.success("Asesor eliminado correctamente.");
      setDeleteTarget(null);
      invalidateAgentQueries();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el asesor.");
    },
  });

  const isSaving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const updateCreateField = <K extends keyof AgentFormInput>(
    key: K,
    value: AgentFormInput[K],
  ) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateEditField = <K extends keyof AgentUpdateInput>(
    key: K,
    value: AgentUpdateInput[K],
  ) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const isCreateValid =
    createForm.firstName.trim() !== "" &&
    createForm.email.trim() !== "" &&
    createForm.password.length >= 8;

  const isEditValid =
    editForm.firstName.trim() !== "" && editForm.email.trim() !== "";

  const openEdit = (agent: TeamProfile) => {
    setEditAgent(agent);
    setEditForm(agentToUpdateForm(agent));
  };

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const handleEditSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto relative">
      {isSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-none">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-elegant">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Guardando cambios…</span>
          </div>
        </div>
      )}

      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Cargando miembros del equipo…"
              : `${agents.length} miembro${agents.length === 1 ? "" : "s"} del equipo`}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setCreateForm(EMPTY_CREATE);
            setCreateOpen(true);
          }}
          className="h-10 px-4 bg-gradient-primary text-primary-foreground shadow-glow"
          disabled={isSaving}
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Miembro del Equipo
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Miembro</th>
                <th className="text-left px-4 py-3 font-medium">Rol</th>
                <th className="text-right px-4 py-3 font-medium">Clientes</th>
                <th className="text-left px-4 py-3 font-medium">Correo</th>
                <th className="text-right px-4 py-3 font-medium min-w-[280px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Cargando datos desde Supabase…
                  </td>
                </tr>
              )}
              {isError && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-destructive">
                    {error instanceof Error
                      ? error.message
                      : "Error al cargar miembros del equipo."}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && agents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No hay miembros registrados. Crea el primero con el botón superior.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                agents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="border-t border-border hover:bg-surface-elevated/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                          {profileInitials(agent)}
                        </div>
                        <div className="font-medium">{profileName(agent)}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-info/15 text-info border-info/30">
                        {getProfileRoleLabel(agent.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {agent.clientCount}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        {agent.email}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-primary/30"
                          disabled={isSaving}
                          onClick={() => setPortfolioAgent(agent)}
                        >
                          <Users className="h-3.5 w-3.5" />
                          Gestionar cartera
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          disabled={isSaving}
                          onClick={() => openEdit(agent)}
                          aria-label={`Editar ${profileName(agent)}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                          disabled={isSaving}
                          onClick={() => setDeleteTarget(agent)}
                          aria-label={`Eliminar ${profileName(agent)}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              Nuevo miembro del equipo
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-form-role">Rol</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) =>
                  updateCreateField("role", value as ProvisionableTeamRole)
                }
              >
                <SelectTrigger
                  id="member-form-role"
                  className="bg-surface-elevated border-border"
                >
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  {CREATE_ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AgentFormFields
              firstName={createForm.firstName}
              lastName={createForm.lastName}
              email={createForm.email}
              password={createForm.password}
              onFirstName={(v) => updateCreateField("firstName", v)}
              onLastName={(v) => updateCreateField("lastName", v)}
              onEmail={(v) => updateCreateField("email", v)}
              onPassword={(v) => updateCreateField("password", v)}
              passwordRequired
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !isCreateValid}
                className={cn("bg-gradient-primary shadow-glow")}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creando…
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4" />
                    Crear miembro
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAgent} onOpenChange={(o) => !o && setEditAgent(null)}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Editar asesor
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <AgentFormFields
              firstName={editForm.firstName}
              lastName={editForm.lastName}
              email={editForm.email}
              password={editForm.password}
              onFirstName={(v) => updateEditField("firstName", v)}
              onLastName={(v) => updateEditField("lastName", v)}
              onEmail={(v) => updateEditField("email", v)}
              onPassword={(v) => updateEditField("password", v)}
              passwordRequired={false}
              passwordHint="Dejar vacío para no cambiar la contraseña."
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setEditAgent(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending || !isEditValid}
                className="bg-gradient-primary shadow-glow"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar asesor?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el perfil de{" "}
              <span className="font-medium text-foreground">
                {deleteTarget ? profileName(deleteTarget) : ""}
              </span>
              . Los clientes asignados quedarán sin asesor. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Eliminando…
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgentPortfolioModal
        agent={portfolioAgent}
        open={!!portfolioAgent}
        onOpenChange={(o) => !o && setPortfolioAgent(null)}
      />
    </div>
  );
}

function AgentFormFields({
  firstName,
  lastName,
  email,
  password,
  onFirstName,
  onLastName,
  onEmail,
  onPassword,
  passwordRequired,
  passwordHint,
}: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  onFirstName: (v: string) => void;
  onLastName: (v: string) => void;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  passwordRequired: boolean;
  passwordHint?: string;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="agent-form-first-name">Nombre</Label>
          <Input
            id="agent-form-first-name"
            value={firstName}
            onChange={(e) => onFirstName(e.target.value)}
            className="bg-surface-elevated border-border"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agent-form-last-name">Apellido</Label>
          <Input
            id="agent-form-last-name"
            value={lastName}
            onChange={(e) => onLastName(e.target.value)}
            className="bg-surface-elevated border-border"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="agent-form-email">Correo de acceso</Label>
        <Input
          id="agent-form-email"
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          className="bg-surface-elevated border-border"
          autoComplete="off"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="agent-form-password">
          {passwordRequired ? "Contraseña temporal" : "Nueva contraseña"}
        </Label>
        <Input
          id="agent-form-password"
          type="password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          className="bg-surface-elevated border-border"
          autoComplete="new-password"
          required={passwordRequired}
          minLength={passwordRequired ? 8 : undefined}
        />
        {passwordHint && (
          <p className="text-xs text-muted-foreground">{passwordHint}</p>
        )}
      </div>
    </>
  );
}
