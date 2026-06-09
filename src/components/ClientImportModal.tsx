import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Phone,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { CountryDisplay } from "@/lib/country-flags";
import { useApp } from "@/lib/app-context";
import {
  applyIntraFileSelections,
  buildImportRows,
  bulkImportWithResolutions,
  detectIntraFileDuplicates,
  fetchAffiliateOptions,
  formatExistingClientLabel,
  formatExistingOwnerLabel,
  formatImportOwnerLabel,
  formatImportRowLabel,
  getDefaultCrmResolutions,
  getDefaultIntraSelections,
  ImportDuplicateKeyError,
  IMPORTABLE_CLIENT_FIELDS,
  isAcceptedImportFile,
  parseSpreadsheetFile,
  partitionImportByExistingClients,
  phoneComparisonKey,
  suggestColumnMapping,
  type ClientImportRow,
  type ColumnMapping,
  type CrmDuplicateConflict,
  type ImportableClientField,
  type IntraFileConflict,
  type ParsedSpreadsheet,
  type PerDuplicateResolution,
} from "@/lib/client-import";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Archivo" },
  { id: 2, label: "Mapeo" },
  { id: 3, label: "Duplicados" },
  { id: 4, label: "Conflictos" },
  { id: 5, label: "Importar" },
] as const;

type WizardStep = (typeof STEPS)[number]["id"];
type MappingPhase = "columns" | "intra";

const ADMIN_ROLES = new Set(["Admin"]);

interface ImportMutationInput {
  nuevosClientes: ClientImportRow[];
  clientesDuplicados: CrmDuplicateConflict[];
  resolutions: Record<string, PerDuplicateResolution>;
}

interface ClientImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ConflictCandidateCard({
  row,
  selected,
  onSelect,
}: {
  row: ClientImportRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-lg border p-4 transition-all w-full",
        "hover:border-primary/50 hover:bg-primary/5",
        selected
          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
          : "border-border bg-surface/40",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          Fila Excel {row.excelRowNumber}
        </span>
        <span
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full border",
            selected
              ? "border-primary text-primary bg-primary/15"
              : "border-border text-muted-foreground",
          )}
        >
          {selected ? "Seleccionado" : "Seleccionar"}
        </span>
      </div>
      <p className="font-medium text-sm">{formatImportRowLabel(row)}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="truncate">{row.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">País</dt>
          <dd>
            <CountryDisplay country={row.country} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Affiliate</dt>
          <dd className="truncate">{row.affiliate ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Lead Status</dt>
          <dd>{row.lead_status}</dd>
        </div>
      </dl>
    </button>
  );
}

function ClientDataPanel({
  title,
  variant,
  name,
  status,
  advisor,
  extra,
}: {
  title: string;
  variant: "crm" | "excel";
  name: string;
  status: string;
  advisor: string;
  extra?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        variant === "crm"
          ? "border-border bg-surface/50"
          : "border-primary/30 bg-primary/5",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Nombre</dt>
          <dd className="font-medium">{name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Estado</dt>
          <dd>{status}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Asesor</dt>
          <dd>{advisor}</dd>
        </div>
      </dl>
      {extra}
    </div>
  );
}

function CrmDuplicateCard({
  conflict,
  resolution,
  onResolve,
}: {
  conflict: CrmDuplicateConflict;
  resolution: PerDuplicateResolution;
  onResolve: (action: PerDuplicateResolution) => void;
}) {
  const { existing, excelRow } = conflict;

  return (
    <section className="rounded-xl border border-border bg-surface/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-elevated/50 flex flex-wrap items-center gap-2">
        <Phone className="h-4 w-4 text-primary shrink-0" />
        <span className="font-mono font-semibold text-sm">{conflict.phone}</span>
        <span className="text-xs text-muted-foreground">
          · Fila Excel {excelRow.excelRowNumber}
        </span>
        <span
          className={cn(
            "ml-auto text-[10px] px-2 py-0.5 rounded-full border",
            resolution === "overwrite"
              ? "border-primary text-primary bg-primary/15"
              : "border-warning/50 text-warning bg-warning/10",
          )}
        >
          {resolution === "overwrite" ? "Sobreescribir" : "Omitir"}
        </span>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          El cliente con teléfono{" "}
          <span className="font-mono text-foreground">{conflict.phone}</span> ya
          existe en la plataforma.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <ClientDataPanel
            title="Datos actuales en el CRM"
            variant="crm"
            name={formatExistingClientLabel(existing)}
            status={existing.lead_status ?? "—"}
            advisor={formatExistingOwnerLabel(existing)}
          />
          <ClientDataPanel
            title="Datos nuevos del Excel"
            variant="excel"
            name={formatImportRowLabel(excelRow)}
            status={excelRow.lead_status}
            advisor={formatImportOwnerLabel(excelRow)}
            extra={
              excelRow.affiliate ? (
                <p className="text-xs text-muted-foreground">
                  Affiliate:{" "}
                  <span className="text-foreground">{excelRow.affiliate}</span>
                </p>
              ) : null
            }
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={resolution === "overwrite" ? "default" : "outline"}
            onClick={() => onResolve("overwrite")}
            className={cn(
              resolution === "overwrite" && "bg-primary hover:bg-primary/90",
            )}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Sobreescribir
          </Button>
          <Button
            type="button"
            size="sm"
            variant={resolution === "skip" ? "secondary" : "outline"}
            onClick={() => onResolve("skip")}
          >
            Omitir
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ClientImportModal({ open, onOpenChange }: ClientImportModalProps) {
  const queryClient = useQueryClient();
  const { profileRole, affiliateName } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAffiliate = profileRole === "Affiliate";
  const canMapAffiliate = profileRole !== null && ADMIN_ROLES.has(profileRole);

  const [step, setStep] = useState<WizardStep>(1);
  const [mappingPhase, setMappingPhase] = useState<MappingPhase>("columns");
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaultAffiliate, setDefaultAffiliate] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [resolvedRows, setResolvedRows] = useState<ClientImportRow[] | null>(null);
  const [intraConflicts, setIntraConflicts] = useState<IntraFileConflict[]>([]);
  const [intraSelections, setIntraSelections] = useState<Record<string, number>>({});
  const [nuevosClientes, setNuevosClientes] = useState<ClientImportRow[]>([]);
  const [clientesDuplicados, setClientesDuplicados] = useState<CrmDuplicateConflict[]>(
    [],
  );
  const [crmResolutions, setCrmResolutions] = useState<
    Record<string, PerDuplicateResolution>
  >({});
  const [crmConflictsResolved, setCrmConflictsResolved] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const { data: affiliateOptions = [] } = useQuery({
    queryKey: ["affiliate-options-import"],
    queryFn: fetchAffiliateOptions,
    enabled: open && canMapAffiliate,
    staleTime: 60_000,
  });

  const mappableFields = useMemo(
    () =>
      IMPORTABLE_CLIENT_FIELDS.filter(
        (field) => field.key !== "affiliate" || canMapAffiliate,
      ),
    [canMapAffiliate],
  );

  const forcedAffiliate = isAffiliate ? affiliateName : null;

  const buildOptions = useMemo(
    () => ({
      forcedAffiliate,
      defaultAffiliate: canMapAffiliate ? defaultAffiliate : null,
    }),
    [forcedAffiliate, defaultAffiliate, canMapAffiliate],
  );

  const rawPreviewRows = useMemo(() => {
    if (!parsed) return [];
    return buildImportRows(parsed, mapping, buildOptions);
  }, [parsed, mapping, buildOptions]);

  const activeRows = resolvedRows ?? rawPreviewRows;
  const activeRowsRef = useRef(activeRows);
  activeRowsRef.current = activeRows;

  const importSummary = useMemo(() => {
    const toUpdate = clientesDuplicados.filter(
      (conflict) =>
        crmResolutions[phoneComparisonKey(conflict.phone)] === "overwrite",
    ).length;
    const toSkip = clientesDuplicados.filter(
      (conflict) =>
        crmResolutions[phoneComparisonKey(conflict.phone)] !== "overwrite",
    ).length;
    return {
      nuevos: nuevosClientes.length,
      actualizar: toUpdate,
      omitir: toSkip,
      total: nuevosClientes.length + toUpdate,
    };
  }, [nuevosClientes, clientesDuplicados, crmResolutions]);

  const resetState = useCallback(() => {
    setStep(1);
    setMappingPhase("columns");
    setParsed(null);
    setMapping({});
    setDefaultAffiliate("");
    setIsDragOver(false);
    setResolvedRows(null);
    setIntraConflicts([]);
    setIntraSelections({});
    setNuevosClientes([]);
    setClientesDuplicados([]);
    setCrmResolutions({});
    setCrmConflictsResolved(false);
    setIsCheckingDuplicates(false);
  }, []);

  const importMutation = useMutation({
    mutationFn: async (input: ImportMutationInput) => {
      const { nuevosClientes: nuevos, clientesDuplicados: duplicados, resolutions } =
        input;

      if (
        nuevos.length === 0 &&
        duplicados.every(
          (conflict) =>
            resolutions[phoneComparisonKey(conflict.phone)] !== "overwrite",
        )
      ) {
        throw new Error("No hay registros seleccionados para importar.");
      }

      return bulkImportWithResolutions(nuevos, duplicados, resolutions);
    },
    onSuccess: (result) => {
      const deniedPart =
        result.denied > 0
          ? `, ${result.denied} actualización${result.denied === 1 ? "" : "es"} rechazada${result.denied === 1 ? "" : "s"} por permisos`
          : "";
      toast.success(
        `Importación completada: ${result.inserted} cliente${result.inserted === 1 ? "" : "s"} nuevo${result.inserted === 1 ? "" : "s"} creado${result.inserted === 1 ? "" : "s"}, ${result.updated} cliente${result.updated === 1 ? "" : "s"} actualizado${result.updated === 1 ? "" : "s"} y ${result.skipped} cliente${result.skipped === 1 ? "" : "s"} omitido${result.skipped === 1 ? "" : "s"}${deniedPart}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
      resetState();
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ImportDuplicateKeyError) {
        toast.error(
          "Se detectaron teléfonos duplicados en el CRM. Elige Sobreescribir u Omitir para continuar.",
        );
        setCrmConflictsResolved(false);
        void (async () => {
          try {
            const partition = await partitionImportByExistingClients(
              activeRowsRef.current,
            );
            setNuevosClientes(partition.nuevosClientes);
            setClientesDuplicados(partition.clientesDuplicados);
            setCrmResolutions(
              getDefaultCrmResolutions(partition.clientesDuplicados),
            );
          } catch {
            // Si la re-validación falla, igual mostramos el paso de conflictos.
          }
          setStep(4);
        })();
        return;
      }

      toast.error(
        err instanceof Error ? err.message : "Error en la importación masiva.",
      );
    },
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && (importMutation.isPending || isCheckingDuplicates)) return;
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const processFile = async (file: File) => {
    if (!isAcceptedImportFile(file)) {
      toast.error("Solo se permiten archivos .xlsx o .csv.");
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseSpreadsheetFile(file);
      setParsed(result);
      setMapping(suggestColumnMapping(result.headers));
      setResolvedRows(null);
      setNuevosClientes([]);
      setClientesDuplicados([]);
      setCrmResolutions({});
      setStep(2);
      setMappingPhase("columns");
      toast.success(`${result.rows.length} filas detectadas en el archivo.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo procesar el archivo.",
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void processFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    handleFileChange(event.dataTransfer.files);
  };

  const updateMapping = (field: ImportableClientField, header: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (header === "__none__") {
        delete next[field];
      } else {
        next[field] = header;
      }
      return next;
    });
    setResolvedRows(null);
    setNuevosClientes([]);
    setClientesDuplicados([]);
    setCrmResolutions({});
  };

  const phoneMapped = Boolean(mapping.phone);
  const canProceedMapping = phoneMapped && rawPreviewRows.length > 0;

  const allIntraResolved = useMemo(() => {
    if (intraConflicts.length === 0) return true;
    return intraConflicts.every(
      (c) => intraSelections[phoneComparisonKey(c.phone)] !== undefined,
    );
  }, [intraConflicts, intraSelections]);

  const runCrmPreValidation = async (rows: ClientImportRow[]) => {
    if (rows.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }

    setIsCheckingDuplicates(true);
    try {
      const partition = await partitionImportByExistingClients(rows);
      setNuevosClientes(partition.nuevosClientes);
      setClientesDuplicados(partition.clientesDuplicados);
      setCrmResolutions(getDefaultCrmResolutions(partition.clientesDuplicados));
      setCrmConflictsResolved(false);

      if (partition.clientesDuplicados.length > 0) {
        setStep(4);
        toast.warning(
          `${partition.clientesDuplicados.length} cliente${partition.clientesDuplicados.length === 1 ? "" : "s"} con teléfono ya registrado${partition.clientesDuplicados.length === 1 ? "" : "s"} en el CRM. Elige Sobreescribir u Omitir para cada uno.`,
        );
      } else {
        setStep(5);
        toast.success("No se detectaron duplicados en la base de datos.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al validar duplicados.",
      );
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleContinueFromMapping = () => {
    const conflicts = detectIntraFileDuplicates(rawPreviewRows);
    if (conflicts.length > 0) {
      setIntraConflicts(conflicts);
      setIntraSelections(getDefaultIntraSelections(conflicts));
      setMappingPhase("intra");
      setStep(3);
      toast.warning(
        `${conflicts.length} teléfono${conflicts.length === 1 ? "" : "s"} repetido${conflicts.length === 1 ? "" : "s"} dentro del archivo.`,
      );
      return;
    }
    setResolvedRows(rawPreviewRows);
    void runCrmPreValidation(rawPreviewRows);
  };

  const handleConfirmIntra = () => {
    const merged = applyIntraFileSelections(rawPreviewRows, intraSelections);
    setResolvedRows(merged);
    setMappingPhase("columns");
    void runCrmPreValidation(merged);
  };

  const handleResolveAllCrm = (action: PerDuplicateResolution) => {
    setCrmResolutions((prev) => {
      const next = { ...prev };
      for (const conflict of clientesDuplicados) {
        const key = phoneComparisonKey(conflict.phone);
        if (key) next[key] = action;
      }
      return next;
    });
    setCrmConflictsResolved(false);
  };

  const handleResolveCrm = (phone: string, action: PerDuplicateResolution) => {
    const key = phoneComparisonKey(phone);
    if (!key) return;
    setCrmResolutions((prev) => ({ ...prev, [key]: action }));
    setCrmConflictsResolved(false);
  };

  const handleContinueFromCrmConflicts = () => {
    if (importSummary.total === 0) {
      toast.error(
        "No hay registros para importar. Elige al menos un cliente nuevo o marca alguno para sobreescribir.",
      );
      return;
    }
    setCrmConflictsResolved(true);
    setStep(5);
  };

  const handleExecuteImport = async () => {
    if (activeRows.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }

    setIsCheckingDuplicates(true);
    try {
      const partition = await partitionImportByExistingClients(activeRows);
      const mergedResolutions: Record<string, PerDuplicateResolution> = {
        ...getDefaultCrmResolutions(partition.clientesDuplicados),
        ...crmResolutions,
      };

      setNuevosClientes(partition.nuevosClientes);
      setClientesDuplicados(partition.clientesDuplicados);
      setCrmResolutions(mergedResolutions);

      if (partition.clientesDuplicados.length > 0 && !crmConflictsResolved) {
        setStep(4);
        toast.warning(
          `Se detectaron ${partition.clientesDuplicados.length} duplicado${partition.clientesDuplicados.length === 1 ? "" : "s"}. Revisa cada teléfono y elige Sobreescribir u Omitir.`,
        );
        return;
      }

      const totalToImport =
        partition.nuevosClientes.length +
        partition.clientesDuplicados.filter(
          (conflict) =>
            mergedResolutions[phoneComparisonKey(conflict.phone)] ===
            "overwrite",
        ).length;

      if (totalToImport === 0) {
        toast.error(
          "No hay registros para importar. Elige al menos un cliente nuevo o marca alguno para sobreescribir.",
        );
        setStep(4);
        setCrmConflictsResolved(false);
        return;
      }

      importMutation.mutate({
        nuevosClientes: partition.nuevosClientes,
        clientesDuplicados: partition.clientesDuplicados,
        resolutions: mergedResolutions,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al validar duplicados.",
      );
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const isBusy = isParsing || importMutation.isPending || isCheckingDuplicates;

  const displayStep = step;

  const handleBack = () => {
    if (step === 5) {
      setCrmConflictsResolved(false);
      setStep(clientesDuplicados.length > 0 ? 4 : intraConflicts.length > 0 ? 3 : 2);
      return;
    }
    if (step === 4) {
      setStep(intraConflicts.length > 0 ? 3 : 2);
      return;
    }
    if (step === 3) {
      setMappingPhase("columns");
      setStep(2);
      return;
    }
    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          "w-[min(96vw,1200px)] max-w-[min(96vw,1200px)] h-[min(92vh,900px)] max-h-[min(92vh,900px)]",
          "bg-card border-border text-foreground",
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/80 shrink-0">
          <DialogTitle className="text-xl font-semibold">
            Importar clientes (Excel / CSV)
          </DialogTitle>
          <DialogDescription>
            Carga masiva con mapeo de columnas, validación de duplicados y
            estampado multi-tenant.
          </DialogDescription>
          <div className="flex items-center gap-2 pt-3 flex-wrap">
            {STEPS.map((s, index) => (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border",
                    displayStep >= s.id
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-surface border-border text-muted-foreground",
                  )}
                >
                  {s.id}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    displayStep >= s.id
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
                {index < STEPS.length - 1 && (
                  <div className="w-8 h-px bg-border mx-1" />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors",
                  isDragOver
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface/40 hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files)}
                />
                {isParsing ? (
                  <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
                ) : (
                  <Upload className="h-10 w-10 text-primary mx-auto mb-3" />
                )}
                <p className="text-sm font-medium">
                  Arrastra tu archivo .xlsx o .csv aquí
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  o haz clic para seleccionar desde tu equipo
                </p>
              </div>
              {parsed && (
                <div className="rounded-lg border border-border bg-surface/50 p-4 flex items-start gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{parsed.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {parsed.headers.length} columnas · {parsed.rows.length}{" "}
                      filas de datos
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && parsed && mappingPhase === "columns" && (
            <div className="space-y-6">
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <p className="text-sm font-medium text-primary">
                  Cabeceras del archivo
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                  {parsed.headers.map((header) => (
                    <span
                      key={header}
                      className="inline-flex rounded-md bg-surface border border-border px-2 py-0.5"
                    >
                      {header}
                    </span>
                  ))}
                </p>
              </div>

              {isAffiliate && forcedAffiliate && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
                  <span className="font-medium text-emerald-400">
                    Multi-tenant:
                  </span>{" "}
                  Todas las filas se asignarán automáticamente al afiliado{" "}
                  <strong>{forcedAffiliate}</strong>.
                </div>
              )}

              {canMapAffiliate && !mapping.affiliate && (
                <div className="space-y-2 max-w-md">
                  <Label>Affiliate general (opcional)</Label>
                  <Select
                    value={defaultAffiliate || "__none__"}
                    onValueChange={(v) => {
                      setDefaultAffiliate(v === "__none__" ? "" : v);
                      setResolvedRows(null);
                      setNuevosClientes([]);
                      setClientesDuplicados([]);
                      setCrmResolutions({});
                    }}
                  >
                    <SelectTrigger className="bg-surface-elevated border-border">
                      <SelectValue placeholder="Seleccionar afiliado para todo el lote" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin asignar</SelectItem>
                      {affiliateOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mappableFields.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-lg border border-border bg-surface/30 p-3 space-y-2"
                  >
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      {field.label}
                      {field.required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    <Select
                      value={mapping[field.key] ?? "__none__"}
                      onValueChange={(v) => updateMapping(field.key, v)}
                    >
                      <SelectTrigger className="h-9 bg-slate-900 border-slate-800 text-sm">
                        <SelectValue placeholder="Columna del archivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— No mapear —</SelectItem>
                        {parsed.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-2 bg-surface-elevated/60 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  Vista previa ({Math.min(rawPreviewRows.length, 5)} de{" "}
                  {rawPreviewRows.length} filas válidas)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left px-3 py-2">Phone</th>
                        <th className="text-left px-3 py-2">Nombre</th>
                        <th className="text-left px-3 py-2">Email</th>
                        <th className="text-left px-3 py-2">Affiliate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawPreviewRows.slice(0, 5).map((row) => (
                        <tr
                          key={row.sourceIndex}
                          className="border-t border-border/60"
                        >
                          <td className="px-3 py-2 font-mono">{row.phone}</td>
                          <td className="px-3 py-2">
                            {[row.first_name, row.last_name]
                              .filter(Boolean)
                              .join(" ") || "—"}
                          </td>
                          <td className="px-3 py-2">{row.email ?? "—"}</td>
                          <td className="px-3 py-2">{row.affiliate ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 3 && mappingPhase === "intra" && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    Teléfonos repetidos en el archivo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    El mismo número aparece en varias filas. Elige cuál
                    conservar; las demás se descartarán del lote.
                  </p>
                </div>
              </div>

              {intraConflicts.map((conflict) => (
                <section
                  key={conflict.phone}
                  className="rounded-xl border border-border bg-surface/30 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border bg-surface-elevated/50 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span className="font-mono font-semibold text-sm">
                      {conflict.phone}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {conflict.candidates.length} filas en conflicto
                    </span>
                  </div>
                  <div className="p-4 grid gap-3 sm:grid-cols-2">
                    {conflict.candidates.map((candidate) => (
                      <ConflictCandidateCard
                        key={candidate.sourceIndex}
                        row={candidate}
                        selected={
                          intraSelections[phoneComparisonKey(conflict.phone)] ===
                          candidate.sourceIndex
                        }
                        onSelect={() =>
                          setIntraSelections((prev) => ({
                            ...prev,
                            [phoneComparisonKey(conflict.phone)]:
                              candidate.sourceIndex,
                          }))
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {isCheckingDuplicates ? (
                <div className="text-center py-16 space-y-4">
                  <Loader2 className="h-14 w-14 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Validando teléfonos contra la base de datos en Supabase…
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 flex flex-wrap items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {clientesDuplicados.length} cliente
                        {clientesDuplicados.length === 1 ? "" : "s"} duplicado
                        {clientesDuplicados.length === 1 ? "" : "s"} detectado
                        {clientesDuplicados.length === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Revisa cada conflicto y decide si sobreescribir los
                        datos del CRM o mantener los registros existentes.
                        {nuevosClientes.length > 0 && (
                          <>
                            {" "}
                            {nuevosClientes.length} fila
                            {nuevosClientes.length === 1 ? "" : "s"} se
                            importará{nuevosClientes.length === 1 ? "" : "n"}{" "}
                            como cliente{nuevosClientes.length === 1 ? "" : "s"}{" "}
                            nuevo{nuevosClientes.length === 1 ? "" : "s"}.
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolveAllCrm("skip")}
                      >
                        Omitir todos
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleResolveAllCrm("overwrite")}
                        className="bg-primary hover:bg-primary/90"
                      >
                        Sobreescribir todos
                      </Button>
                    </div>
                  </div>

                  {clientesDuplicados.map((conflict) => (
                    <CrmDuplicateCard
                      key={phoneComparisonKey(conflict.phone)}
                      conflict={conflict}
                      resolution={
                        crmResolutions[phoneComparisonKey(conflict.phone)] ??
                        "skip"
                      }
                      onResolve={(action) =>
                        handleResolveCrm(conflict.phone, action)
                      }
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {step === 5 && parsed && (
            <div className="max-w-lg mx-auto space-y-6 text-center py-8">
              <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Listo para importar</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Revisa el resumen y confirma la operación en la base de datos.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface/40 p-4 text-left space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Archivo:</span>{" "}
                  {parsed.fileName}
                </p>
                <p>
                  <span className="text-muted-foreground">Filas en lote:</span>{" "}
                  {activeRows.length}
                </p>
                <p>
                  <span className="text-muted-foreground">Nuevos clientes:</span>{" "}
                  {importSummary.nuevos}
                </p>
                <p>
                  <span className="text-muted-foreground">A actualizar:</span>{" "}
                  {importSummary.actualizar}
                </p>
                <p>
                  <span className="text-muted-foreground">A omitir:</span>{" "}
                  {importSummary.omitir}
                </p>
                {isAffiliate && forcedAffiliate && (
                  <p>
                    <span className="text-muted-foreground">Affiliate:</span>{" "}
                    {forcedAffiliate}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/80 shrink-0 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isBusy}
          >
            Cancelar
          </Button>
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isBusy}
            >
              Atrás
            </Button>
          )}
          {step === 1 && parsed && (
            <Button type="button" onClick={() => setStep(2)} disabled={isBusy}>
              Continuar al mapeo
            </Button>
          )}
          {step === 2 && mappingPhase === "columns" && (
            <Button
              type="button"
              onClick={handleContinueFromMapping}
              disabled={!canProceedMapping || isBusy}
            >
              {isCheckingDuplicates ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validando…
                </>
              ) : (
                "Continuar"
              )}
            </Button>
          )}
          {step === 3 && mappingPhase === "intra" && (
            <Button
              type="button"
              onClick={handleConfirmIntra}
              disabled={!allIntraResolved || isBusy}
              className="bg-primary hover:bg-primary/90"
            >
              {isCheckingDuplicates ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validando…
                </>
              ) : (
                "Confirmar selección"
              )}
            </Button>
          )}
          {step === 4 && !isCheckingDuplicates && (
            <Button
              type="button"
              onClick={handleContinueFromCrmConflicts}
              disabled={clientesDuplicados.length === 0 || isBusy}
              className="bg-primary hover:bg-primary/90"
            >
              Continuar a importación
            </Button>
          )}
          {step === 5 && (
            <Button
              type="button"
              onClick={() => void handleExecuteImport()}
              disabled={isBusy || importSummary.total === 0}
              className="bg-primary hover:bg-primary/90"
            >
              {importMutation.isPending || isCheckingDuplicates ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isCheckingDuplicates ? "Validando…" : "Importando…"}
                </>
              ) : (
                "Ejecutar importación"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
