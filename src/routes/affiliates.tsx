import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/lib/app-context";
import { formatClientDate } from "@/lib/secure-clients";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/affiliates")({ component: AffiliatesPage });

const AFFILIATES_QUERY_KEY = ["affiliates"] as const;

export interface Affiliate {
  id: number;
  name: string;
  created_at: string;
  responsibleName: string;
  email: string;
}

interface AffiliateFormInput {
  companyName: string;
  responsibleName: string;
  email: string;
  password: string;
}

interface AffiliateRowFromDb {
  id: number;
  name: string;
  created_at: string;
  profiles:
    | { email: string; first_name: string | null }
    | { email: string; first_name: string | null }[]
    | null;
}

const EMPTY_FORM: AffiliateFormInput = {
  companyName: "",
  responsibleName: "",
  email: "",
  password: "",
};

function normalizeProfile(
  profiles: AffiliateRowFromDb["profiles"],
): { email: string; first_name: string | null } | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0] ?? null;
  return profiles;
}

interface AffiliateProfileRow {
  affiliate_id: number;
  email: string;
  first_name: string | null;
}

function mapAffiliateRow(
  row: AffiliateRowFromDb,
  profileOverride?: { email: string; first_name: string | null } | null,
): Affiliate {
  const profile =
    profileOverride !== undefined
      ? profileOverride
      : normalizeProfile(row.profiles);
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    responsibleName: profile?.first_name?.trim() ?? "",
    email: profile?.email?.trim() ?? "",
  };
}

async function fetchProfilesByAffiliateIds(
  ids: number[],
): Promise<Map<number, { email: string; first_name: string | null }>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("affiliate_id, email, first_name")
    .in("affiliate_id", ids);

  if (error) throw error;

  const map = new Map<number, { email: string; first_name: string | null }>();
  for (const row of (data ?? []) as AffiliateProfileRow[]) {
    if (row.affiliate_id != null) {
      map.set(row.affiliate_id, { email: row.email, first_name: row.first_name });
    }
  }
  return map;
}

function affiliateToForm(row: Affiliate): AffiliateFormInput {
  return {
    companyName: row.name,
    responsibleName: row.responsibleName,
    email: row.email,
    password: "",
  };
}

async function fetchAffiliates(): Promise<Affiliate[]> {
  try {
    const { data, error } = await supabase
      .from("affiliates")
      .select("id, name, created_at, profiles(email, first_name)")
      .order("created_at", { ascending: false });

    let rows: AffiliateRowFromDb[];

    if (error) {
      const { data: basic, error: basicError } = await supabase
        .from("affiliates")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });

      if (basicError) throw basicError;
      rows = ((basic ?? []) as Omit<AffiliateRowFromDb, "profiles">[]).map((row) => ({
        ...row,
        profiles: null,
      }));
    } else {
      rows = (data ?? []) as AffiliateRowFromDb[];
    }

    const needsProfileFallback = rows.some((row) => !normalizeProfile(row.profiles));
    if (!needsProfileFallback) {
      return rows.map((row) => mapAffiliateRow(row));
    }

    const profileMap = await fetchProfilesByAffiliateIds(rows.map((row) => row.id));
    return rows.map((row) =>
      mapAffiliateRow(row, profileMap.get(row.id) ?? null),
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudieron cargar las afiliadoras.";
    throw new Error(message);
  }
}

async function fetchAffiliateById(id: number): Promise<Affiliate> {
  try {
    const { data, error } = await supabase
      .from("affiliates")
      .select("id, name, created_at, profiles(email, first_name)")
      .eq("id", id)
      .single();

    if (error) {
      const { data: basic, error: basicError } = await supabase
        .from("affiliates")
        .select("id, name, created_at")
        .eq("id", id)
        .single();

      if (basicError) throw basicError;
      if (!basic) throw new Error("Afiliadora no encontrada.");

      const profileMap = await fetchProfilesByAffiliateIds([id]);
      return mapAffiliateRow(
        { ...(basic as Omit<AffiliateRowFromDb, "profiles">), profiles: null },
        profileMap.get(id) ?? null,
      );
    }

    if (!data) throw new Error("Afiliadora no encontrada.");

    const row = data as AffiliateRowFromDb;
    if (normalizeProfile(row.profiles)) {
      return mapAffiliateRow(row);
    }

    const profileMap = await fetchProfilesByAffiliateIds([id]);
    return mapAffiliateRow(row, profileMap.get(id) ?? null);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudieron cargar los datos de la afiliadora.";
    throw new Error(message);
  }
}

async function createAffiliateWithUser(data: AffiliateFormInput): Promise<void> {
  try {
    const companyName = data.companyName.trim();
    const responsibleName = data.responsibleName.trim();
    const email = data.email.trim();
    const password = data.password;

    if (!companyName) throw new Error("El nombre de la empresa es obligatorio.");
    if (!responsibleName) throw new Error("El nombre del responsable es obligatorio.");
    if (!email) throw new Error("El correo electrónico es obligatorio.");
    if (!password) throw new Error("La contraseña temporal es obligatoria.");

    const { error } = await supabase.rpc("create_affiliate_with_user", {
      company_name: companyName,
      user_email: email,
      user_password: password,
      user_first_name: responsibleName,
    });

    if (error) throw error;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo crear la afiliadora y su cuenta de acceso.";
    throw new Error(message);
  }
}

async function updateAffiliateWithUser(
  affiliateId: number,
  data: AffiliateFormInput,
): Promise<void> {
  try {
    const companyName = data.companyName.trim();
    const responsibleName = data.responsibleName.trim();
    const email = data.email.trim();
    const password = data.password.trim();

    if (!companyName) throw new Error("El nombre de la empresa es obligatorio.");
    if (!responsibleName) throw new Error("El nombre del responsable es obligatorio.");
    if (!email) throw new Error("El correo electrónico es obligatorio.");

    const { error } = await supabase.rpc("update_affiliate_with_user", {
      affiliate_id: affiliateId,
      company_name: companyName,
      user_email: email,
      user_first_name: responsibleName,
      user_password: password || null,
    });

    if (error) throw error;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo actualizar la afiliadora.";
    throw new Error(message);
  }
}

async function deleteAffiliate(id: number): Promise<void> {
  try {
    const { error } = await supabase.from("affiliates").delete().eq("id", id);
    if (error) throw error;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo eliminar la afiliadora.";
    throw new Error(message);
  }
}

function AccessDenied() {
  return (
    <div className="p-8 max-w-md mx-auto mt-20 text-center animate-fade-in-up">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface-elevated/60">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mt-6">Acceso restringido</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Esta sección está reservada exclusivamente para administradores del sistema.
      </p>
      <Button className="mt-6" asChild>
        <Link to="/">Volver al Dashboard</Link>
      </Button>
    </div>
  );
}

function AffiliatesPage() {
  const { profileRole } = useApp();

  if (profileRole === null) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (profileRole !== "Admin") {
    return <AccessDenied />;
  }

  return <AffiliatesCrud />;
}

function AffiliateFormFields({
  form,
  isEditing,
  onChange,
}: {
  form: AffiliateFormInput;
  isEditing: boolean;
  onChange: <K extends keyof AffiliateFormInput>(key: K, value: AffiliateFormInput[K]) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="affiliate-company-name">Nombre de la Empresa Afiliadora</Label>
        <Input
          id="affiliate-company-name"
          value={form.companyName}
          onChange={(e) => onChange("companyName", e.target.value)}
          placeholder="Ej. Quant Partners LLC"
          className="bg-surface-elevated border-border"
          autoFocus
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="affiliate-responsible-name">Nombre del Responsable</Label>
        <Input
          id="affiliate-responsible-name"
          value={form.responsibleName}
          onChange={(e) => onChange("responsibleName", e.target.value)}
          placeholder="Ej. María González"
          className="bg-surface-elevated border-border"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="affiliate-email">Correo Electrónico de Acceso</Label>
        <Input
          id="affiliate-email"
          type="email"
          value={form.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="acceso@empresa.com"
          className="bg-surface-elevated border-border"
          autoComplete="off"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="affiliate-password">
          {isEditing ? "Nueva Contraseña" : "Contraseña Temporal"}
        </Label>
        <Input
          id="affiliate-password"
          type="password"
          value={form.password}
          onChange={(e) => onChange("password", e.target.value)}
          placeholder={isEditing ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"}
          className="bg-surface-elevated border-border"
          autoComplete="new-password"
          required={!isEditing}
        />
        {isEditing && (
          <p className="text-xs text-muted-foreground">
            Solo completa este campo si deseas restablecer la contraseña de acceso.
          </p>
        )}
      </div>
    </>
  );
}

function AffiliatesCrud() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AffiliateFormInput>(EMPTY_FORM);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Affiliate | null>(null);
  const { data: affiliates = [], isLoading, isError, error } = useQuery({
    queryKey: AFFILIATES_QUERY_KEY,
    queryFn: fetchAffiliates,
    staleTime: 30_000,
  });

  const isEditing = editingId !== null;

  const openCreate = () => {
    setEditingId(null);
    setIsLoadingEdit(false);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = async (row: Affiliate) => {
    setEditingId(row.id);
    setFormOpen(true);
    setIsLoadingEdit(true);
    setForm(affiliateToForm(row));

    try {
      const fresh = await fetchAffiliateById(row.id);
      setForm(affiliateToForm(fresh));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudieron cargar los datos para editar.",
      );
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setIsLoadingEdit(false);
    setForm(EMPTY_FORM);
  };

  const updateFormField = <K extends keyof AffiliateFormInput>(
    key: K,
    value: AffiliateFormInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isFormValid =
    form.companyName.trim() !== "" &&
    form.responsibleName.trim() !== "" &&
    form.email.trim() !== "" &&
    (isEditing || form.password !== "");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEditing && editingId !== null) {
        return updateAffiliateWithUser(editingId, form);
      }
      return createAffiliateWithUser(form);
    },
    onSuccess: () => {
      if (isEditing) {
        toast.success("Afiliadora y cuenta de acceso actualizadas correctamente.");
      } else {
        toast.success("Afiliadora y cuenta de acceso creadas correctamente.");
      }
      closeForm();
      void queryClient.invalidateQueries({ queryKey: AFFILIATES_QUERY_KEY });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al guardar la afiliadora.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAffiliate(id),
    onSuccess: () => {
      toast.success("Afiliadora eliminada correctamente.");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: AFFILIATES_QUERY_KEY });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al eliminar la afiliadora.");
    },
  });

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Gestión de Afiliadoras
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Cargando afiliadoras…"
              : `${affiliates.length} empresa${affiliates.length === 1 ? "" : "s"} registrada${affiliates.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="h-10 px-4 bg-success text-success-foreground hover:bg-success/90 shadow-glow"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Afiliadora
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium w-28">ID</th>
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Fecha de creación</th>
                <th className="text-right px-4 py-3 font-medium w-36">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Cargando datos desde Supabase…
                  </td>
                </tr>
              )}
              {isError && !isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-destructive">
                    {error instanceof Error ? error.message : "Error al cargar afiliadoras."}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && affiliates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No hay empresas afiliadoras registradas.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                affiliates.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border hover:bg-surface-elevated/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground tabular-nums">
                      {row.id}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatClientDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="h-8 w-8 rounded-md bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 flex items-center justify-center"
                          aria-label={`Editar ${row.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row)}
                          className="h-8 w-8 rounded-md bg-destructive/15 hover:bg-destructive/25 text-destructive border border-destructive/30 flex items-center justify-center"
                          aria-label={`Eliminar ${row.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Afiliadora" : "Nueva Afiliadora"}
            </DialogTitle>
          </DialogHeader>
          {isLoadingEdit ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Cargando datos de la afiliadora…
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <AffiliateFormFields
                form={form}
                isEditing={isEditing}
                onChange={updateFormField}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending || !isFormValid}
                  className={cn(
                    !isEditing && "bg-success text-success-foreground hover:bg-success/90",
                  )}
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando…
                    </>
                  ) : isEditing ? (
                    "Guardar cambios"
                  ) : (
                    "Crear afiliadora"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar afiliadora?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>.
              Esta acción no se puede deshacer.
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
    </div>
  );
}
