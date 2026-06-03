import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarClock,
  Clock,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  PhoneCall,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import {
  deleteActivityLog,
  fetchActivityLogsByPhone,
  formatActivityDateTime,
  getActivityAgentName,
  insertActivityLog,
  updateActivityLog,
  type ActivityLog,
} from "@/lib/activity-logs";
import {
  canCreateActivityNotes,
  canManageActivityLogs,
  canViewActivityHistory,
} from "@/lib/activity-rbac";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const activityTypeStyles: Record<string, string> = {
  comment: "bg-info/15 text-info border-info/30",
  call: "bg-success/15 text-success border-success/30",
  follow_up: "bg-warning/15 text-warning border-warning/30",
  status_change: "bg-primary/15 text-primary border-primary/30",
};

function ActivityTimelineItem({
  log,
  canManage,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  log: ActivityLog;
  canManage: boolean;
  onUpdate: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(log.text);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const typeKey = log.type?.toLowerCase() ?? "comment";
  const Icon =
    typeKey === "call"
      ? PhoneCall
      : typeKey === "follow_up"
        ? CalendarClock
        : typeKey === "comment"
          ? MessageSquare
          : Activity;

  const handleStartEdit = () => {
    setDraft(log.text);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraft(log.text);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("El comentario no puede estar vacío.");
      return;
    }
    try {
      await onUpdate(log.id, trimmed);
      setIsEditing(false);
    } catch {
      // toast desde el padre
    }
  };

  return (
    <div className="relative pl-8 pb-6 last:pb-0">
      <span className="absolute left-[11px] top-0 bottom-0 w-px bg-border/80" />
      <span className="absolute left-0 top-1 h-[22px] w-[22px] rounded-full border border-border bg-surface-elevated flex items-center justify-center">
        <Icon className="h-3 w-3 text-muted-foreground" />
      </span>
      <div
        className={cn(
          "rounded-lg border border-border/80 bg-surface/60 p-4 shadow-sm transition-colors",
          !isEditing && "hover:bg-surface-elevated/40",
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium border",
                activityTypeStyles[typeKey] ??
                  "bg-muted/30 text-muted-foreground border-border",
              )}
            >
              {log.type || "comment"}
            </Badge>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {formatActivityDateTime(log.created_at)}
            </span>
          </div>

          {canManage && !isEditing && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleStartEdit}
                disabled={isUpdating || isDeleting}
                aria-label="Editar actividad"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    disabled={isUpdating || isDeleting}
                    aria-label="Más acciones"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={handleStartEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[72px] resize-none bg-surface border-border text-sm"
              disabled={isUpdating}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isUpdating}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveEdit}
                disabled={isUpdating || !draft.trim()}
              >
                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {log.text}
          </p>
        )}

        {!isEditing && (
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
            <User className="h-3 w-3" />
            {getActivityAgentName(log)}
          </p>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta actividad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await onDelete(log.id);
                  setDeleteOpen(false);
                } catch {
                  // toast desde el padre
                }
              }}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ClientActivityPanelProps {
  /** Teléfono canónico desde `client.phone` (BD), no el parámetro crudo de la URL. */
  clientPhone: string | null | undefined;
  className?: string;
}

export function ClientActivityPanel({
  clientPhone,
  className,
}: ClientActivityPanelProps) {
  const { profileRole } = useApp();
  const { user: profile, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [pendingLogId, setPendingLogId] = useState<string | null>(null);

  const resolvedPhone =
    typeof clientPhone === "string" ? clientPhone.trim() : "";

  const canCreateNotes = canCreateActivityNotes(profileRole);
  const canManageLogs = canManageActivityLogs(profileRole);
  const isFieldOperatorViewer =
    profileRole === "Agent" || profileRole === "Assistant";
  const activityQueryKey = ["activity-logs", resolvedPhone, profile?.id] as const;
  const isActivityQueryEnabled = !!profile && resolvedPhone.length > 0;

  const {
    data: activities = [],
    isLoading: isActivitiesLoading,
    isFetching: isActivitiesFetching,
    isError: isActivitiesError,
    error: activitiesError,
  } = useQuery({
    queryKey: activityQueryKey,
    queryFn: () => fetchActivityLogsByPhone(resolvedPhone),
    enabled: isActivityQueryEnabled,
    staleTime: 15_000,
  });

  const isHistoryPending =
    isAuthLoading || !isActivityQueryEnabled || isActivitiesLoading || isActivitiesFetching;

  const noteMutation = useMutation({
    mutationFn: (text: string) => {
      if (!canCreateNotes) throw new Error("No tienes permiso para crear notas.");
      if (!profile?.id) throw new Error("Sesión no válida.");
      return insertActivityLog({
        client_phone: resolvedPhone,
        agent_id: profile.id,
        text,
        type: "comment",
      });
    },
    onSuccess: () => {
      setNoteText("");
      toast.success("Nota guardada.");
      void queryClient.invalidateQueries({ queryKey: activityQueryKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la nota.");
    },
  });

  const updateLogMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => {
      if (!canManageLogs) throw new Error("No tienes permiso para editar notas.");
      return updateActivityLog(id, text);
    },
    onMutate: ({ id }) => setPendingLogId(id),
    onSuccess: () => {
      toast.success("Actividad actualizada.");
      void queryClient.invalidateQueries({ queryKey: activityQueryKey });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "No se pudo actualizar la actividad.",
      );
    },
    onSettled: () => setPendingLogId(null),
  });

  const deleteLogMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canManageLogs) throw new Error("No tienes permiso para eliminar notas.");
      return deleteActivityLog(id);
    },
    onMutate: (id) => setPendingLogId(id),
    onSuccess: () => {
      toast.success("Actividad eliminada.");
      void queryClient.invalidateQueries({ queryKey: activityQueryKey });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "No se pudo eliminar la actividad.",
      );
    },
    onSettled: () => setPendingLogId(null),
  });

  const handleSaveNote = () => {
    if (!canCreateNotes) return;
    const trimmed = noteText.trim();
    if (!trimmed) {
      toast.error("Escribe una nota antes de guardar.");
      return;
    }
    noteMutation.mutate(trimmed);
  };

  const handleUpdateLog = async (id: string, text: string) => {
    if (!canManageLogs) return;
    await updateLogMutation.mutateAsync({ id, text });
  };

  const handleDeleteLog = async (id: string) => {
    if (!canManageLogs) return;
    await deleteLogMutation.mutateAsync(id);
  };

  return (
    <Card
      className={cn(
        "flex-1 min-h-[520px] border-border bg-card/40 flex flex-col overflow-hidden",
        className,
      )}
    >
      <CardHeader className="pb-3 shrink-0 border-b border-border/60">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-info" />
          Historial de actividad
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 pt-4 gap-4">
        {canCreateNotes && (
          <>
            <div className="space-y-2 shrink-0">
              <Label htmlFor="client-note" className="text-xs text-muted-foreground">
                Nueva nota
              </Label>
              <Textarea
                id="client-note"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Escribe una nota sobre este cliente…"
                className="min-h-[88px] resize-none bg-surface border-border focus-visible:ring-primary/40"
                disabled={noteMutation.isPending}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveNote}
                  disabled={noteMutation.isPending || !noteText.trim()}
                >
                  {noteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4" />
                      Guardar Nota
                    </>
                  )}
                </Button>
              </div>
            </div>
            <Separator className="bg-border/60 shrink-0" />
          </>
        )}

        {profileRole === "Affiliate" && (
          <p className="text-xs text-muted-foreground shrink-0 rounded-lg border border-border/60 bg-surface/50 px-3 py-2">
            Vista de solo lectura: las afiliadoras pueden consultar el historial, pero no
            crear ni modificar comentarios.
          </p>
        )}

        {isFieldOperatorViewer && (
          <p className="text-xs text-muted-foreground shrink-0 rounded-lg border border-info/30 bg-info/10 px-3 py-2">
            Puedes consultar el historial y registrar nuevas notas. No puedes editar ni
            eliminar actividades pasadas.
          </p>
        )}

        <ScrollArea className="flex-1 min-h-[280px] pr-3">
          {!canViewActivityHistory(profileRole) && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No tienes permiso para ver este historial.
            </p>
          )}

          {canViewActivityHistory(profileRole) && isHistoryPending && (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {canViewActivityHistory(profileRole) && isActivitiesError && !isHistoryPending && (
            <p className="text-sm text-destructive py-4">
              {activitiesError instanceof Error
                ? activitiesError.message
                : "Error al cargar el historial."}
            </p>
          )}

          {canViewActivityHistory(profileRole) &&
            !isHistoryPending &&
            !isActivitiesError &&
            activities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">Sin actividad registrada aún.</p>
            </div>
          )}

          {canViewActivityHistory(profileRole) &&
            !isHistoryPending &&
            !isActivitiesError &&
            activities.length > 0 && (
            <div className="pt-1">
              {activities.map((log) => (
                <ActivityTimelineItem
                  key={log.id}
                  log={log}
                  canManage={canManageLogs}
                  onUpdate={handleUpdateLog}
                  onDelete={handleDeleteLog}
                  isUpdating={updateLogMutation.isPending && pendingLogId === log.id}
                  isDeleting={deleteLogMutation.isPending && pendingLogId === log.id}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
