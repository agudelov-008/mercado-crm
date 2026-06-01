import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useApp } from "@/lib/app-context";
import {
  fetchAffiliateOptions,
  fetchAgentProfileOptions,
  insertManualClient,
  isClientPhoneRegistered,
  normalizeClientPhone,
  type DbClientRow,
} from "@/lib/client-import";
import { LEAD_STATUS_OPTIONS, type LeadStatus } from "@/lib/secure-clients";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const leadStatusEnum = LEAD_STATUS_OPTIONS as unknown as readonly [
  LeadStatus,
  ...LeadStatus[],
];

const manualClientSchema = z
  .object({
    first_name: z.string().trim().min(1, "El nombre es obligatorio"),
    last_name: z.string().optional(),
    phone: z.string().trim().min(1, "El teléfono es obligatorio"),
    email: z.string().trim().optional(),
    country: z.string().trim().optional(),
    tp_account: z.string().trim().optional(),
    lead_status: z.enum(leadStatusEnum),
    affiliate: z.string().optional(),
    owner_id: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.email && data.email.length > 0) {
      const result = z.string().email().safeParse(data.email);
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Email inválido",
          path: ["email"],
        });
      }
    }
  });

type ManualClientFormValues = z.infer<typeof manualClientSchema>;

const EMPTY_VALUES: ManualClientFormValues = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  country: "",
  tp_account: "",
  lead_status: "New",
  affiliate: "",
  owner_id: "",
};

const NONE_OWNER = "__none__";
const NONE_AFFILIATE = "__none__";

interface ManualClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualClientModal({ open, onOpenChange }: ManualClientModalProps) {
  const queryClient = useQueryClient();
  const { profileRole, affiliateName } = useApp();

  const isAffiliate = profileRole === "Affiliate";
  const canManageAffiliate =
    profileRole === "Admin" || profileRole === "Manager";

  const form = useForm<ManualClientFormValues>({
    resolver: zodResolver(manualClientSchema),
    defaultValues: EMPTY_VALUES,
  });

  const { data: affiliateOptions = [], isLoading: affiliatesLoading } = useQuery({
    queryKey: ["affiliate-options-manual"],
    queryFn: fetchAffiliateOptions,
    enabled: open && canManageAffiliate,
    staleTime: 60_000,
  });

  const { data: agentOptions = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agent-profiles-manual"],
    queryFn: fetchAgentProfileOptions,
    enabled: open && canManageAffiliate,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      form.reset(EMPTY_VALUES);
    }
  }, [open, form]);

  const createMutation = useMutation({
    mutationFn: (payload: DbClientRow) => insertManualClient(payload),
    onSuccess: () => {
      toast.success("Cliente creado correctamente.");
      void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
      form.reset(EMPTY_VALUES);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el cliente.",
      );
    },
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && createMutation.isPending) return;
    if (!nextOpen) form.reset(EMPTY_VALUES);
    onOpenChange(nextOpen);
  };

  const onSubmit = async (values: ManualClientFormValues) => {
    const phone = normalizeClientPhone(values.phone);

    try {
      const exists = await isClientPhoneRegistered(phone);
      if (exists) {
        form.setError("phone", {
          type: "manual",
          message: "Este número de teléfono ya está registrado en el CRM",
        });
        return;
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al validar el teléfono.",
      );
      return;
    }

    const affiliate = isAffiliate
      ? affiliateName
      : values.affiliate && values.affiliate !== NONE_AFFILIATE
        ? values.affiliate
        : null;

    const ownerId =
      values.owner_id && values.owner_id !== NONE_OWNER
        ? values.owner_id
        : null;

    const payload: DbClientRow = {
      first_name: values.first_name.trim(),
      last_name: values.last_name?.trim() || null,
      phone,
      email: values.email?.trim() || null,
      country: values.country?.trim() || null,
      tp_account: values.tp_account?.trim() || null,
      lead_status: values.lead_status,
      affiliate,
      owner_id: ownerId,
    };

    createMutation.mutate(payload);
  };

  const isBusy = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[min(92vh,800px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Agregar cliente
          </DialogTitle>
          <DialogDescription>
            Carga manual uno a uno. El teléfono es la clave única del registro.
          </DialogDescription>
        </DialogHeader>

        {isAffiliate && affiliateName && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
            <span className="font-medium text-emerald-400">Afiliado:</span>{" "}
            {affiliateName}
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nombre <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Nombre"
                        className="bg-surface-elevated border-border"
                        disabled={isBusy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Apellido"
                        className="bg-surface-elevated border-border"
                        disabled={isBusy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Teléfono <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      inputMode="tel"
                      placeholder="+57 300 000 0000"
                      className={cn(
                        "bg-surface-elevated border-border font-mono",
                        form.formState.errors.phone && "border-destructive",
                      )}
                      disabled={isBusy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="correo@ejemplo.com"
                      className="bg-surface-elevated border-border"
                      disabled={isBusy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>País</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Colombia"
                        className="bg-surface-elevated border-border"
                        disabled={isBusy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tp_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta TP</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="TP-0000"
                        className="bg-surface-elevated border-border"
                        disabled={isBusy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="lead_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status del Lead</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isBusy}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-surface-elevated border-border">
                        <SelectValue placeholder="Lead Status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAD_STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {canManageAffiliate && (
              <>
                <FormField
                  control={form.control}
                  name="affiliate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Afiliadora</FormLabel>
                      <Select
                        value={field.value || NONE_AFFILIATE}
                        onValueChange={field.onChange}
                        disabled={isBusy || affiliatesLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-surface-elevated border-border">
                            <SelectValue
                              placeholder={
                                affiliatesLoading
                                  ? "Cargando afiliados…"
                                  : "Seleccionar afiliado"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE_AFFILIATE}>
                            Sin asignar
                          </SelectItem>
                          {affiliateOptions.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="owner_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agente (opcional)</FormLabel>
                      <Select
                        value={field.value || NONE_OWNER}
                        onValueChange={field.onChange}
                        disabled={isBusy || agentsLoading}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-surface-elevated border-border">
                            <SelectValue
                              placeholder={
                                agentsLoading
                                  ? "Cargando agentes…"
                                  : "Asignar agente"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE_OWNER}>Sin asignar</SelectItem>
                          {agentOptions.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isBusy}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isBusy}
                className="bg-primary hover:bg-primary/90"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Guardar cliente"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
