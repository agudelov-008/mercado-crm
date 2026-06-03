import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  ExternalLink,
  Loader2,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteAppointment,
  formatAppointmentDateTime,
  formatAppointmentTime,
  getAppointmentClientName,
  type Appointment,
} from "@/lib/appointments";
import { clientDetailIdFromPhone } from "@/lib/secure-clients";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppointmentFormModal } from "@/components/AppointmentFormModal";

interface AppointmentDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  canManage: boolean;
}

export function AppointmentDetailModal({
  open,
  onOpenChange,
  appointment,
  canManage,
}: AppointmentDetailModalProps) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!appointment) throw new Error("Cita no encontrada.");
      return deleteAppointment(appointment.id);
    },
    onSuccess: () => {
      toast.success("Cita eliminada.");
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setDeleteOpen(false);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la cita.");
    },
  });

  if (!appointment) return null;

  const clientName = getAppointmentClientName(appointment);
  const clientPath = `/clients/${clientDetailIdFromPhone(appointment.client_phone)}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-6">
              <CalendarClock className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">{appointment.title}</span>
            </DialogTitle>
            <DialogDescription>
              {formatAppointmentDateTime(appointment.starts_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{clientName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Hora:</span>
                <span className="font-medium tabular-nums">
                  {formatAppointmentTime(appointment.starts_at)}
                </span>
              </div>
            </div>

            {appointment.description && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Descripción
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap rounded-lg border border-border bg-surface p-3">
                  {appointment.description}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to={clientPath} onClick={() => onOpenChange(false)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver perfil del cliente
              </Link>
            </Button>

            {canManage && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                  className="flex-1 sm:flex-none"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                  className="flex-1 sm:flex-none"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canManage && (
        <>
          <AppointmentFormModal
            open={editOpen}
            onOpenChange={setEditOpen}
            clientPhone={appointment.client_phone}
            clientLabel={clientName}
            appointment={appointment}
          />

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar esta cita?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará permanentemente &quot;{appointment.title}&quot; del calendario.
                  Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    deleteMutation.mutate();
                  }}
                  disabled={deleteMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}
