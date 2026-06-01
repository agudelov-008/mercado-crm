import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Phone,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-context";
import {
  applyIntraFileSelections,
  buildImportRows,
  bulkImportClients,
  checkImportDuplicates,
  detectIntraFileDuplicates,
  fetchAffiliateOptions,
  formatImportRowLabel,
  getDefaultIntraSelections,
  IMPORTABLE_CLIENT_FIELDS,
  isAcceptedImportFile,
  parseSpreadsheetFile,
  suggestColumnMapping,
  type ClientImportRow,
  type ColumnMapping,
  type DuplicateResolution,
  type ImportableClientField,
  type IntraFileConflict,
  type ParsedSpreadsheet,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  { id: 4, label: "Importar" },
] as const;

const ADMIN_ROLES = new Set(["Admin", "Manager", "Assistant"]);

type MappingPhase = "columns" | "intra";

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
          <dd>{row.country ?? "—"}</dd>
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

export function ClientImportModal({ open, onOpenChange }: ClientImportModalProps) {
  const queryClient = useQueryClient();
  const { profileRole, affiliateName } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAffiliate = profileRole === "Affiliate";
  const canMapAffiliate = profileRole !== null && ADMIN_ROLES.has(profileRole);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [mappingPhase, setMappingPhase] = useState<MappingPhase>("columns");
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defaultAffiliate, setDefaultAffiliate] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [resolvedRows, setResolvedRows] = useState<ClientImportRow[] | null>(null);
  const [intraConflicts, setIntraConflicts] = useState<IntraFileConflict[]>([]);
  const [intraSelections, setIntraSelections] = useState<Record<string, number>>({});
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<DuplicateResolution>("skip");
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
    setDuplicateOpen(false);
    setDuplicateCount(0);
    setDuplicateStrategy("skip");
    setIsCheckingDuplicates(false);
  }, []);

  const importMutation = useMutation({
    mutationFn: async (strategy: DuplicateResolution) => {
      if (activeRows.length === 0) {
        throw new Error("No hay filas válidas con teléfono.");
      }
      return bulkImportClients(activeRows, strategy);
    },
    onSuccess: (result) => {
      const total = result.inserted + result.updated;
      toast.success(
        `Carga masiva completada: ${total} cliente${total === 1 ? "" : "s"} importado${total === 1 ? "" : "s"}${result.skipped > 0 ? `, ${result.skipped} omitido${result.skipped === 1 ? "" : "s"}` : ""}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
      resetState();
      onOpenChange(false);
    },
    onError: (err) => {
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
  };

  const phoneMapped = Boolean(mapping.phone);
  const canProceedMapping = phoneMapped && rawPreviewRows.length > 0;

  const allIntraResolved = useMemo(() => {
    if (intraConflicts.length === 0) return true;
    return intraConflicts.every(
      (c) => intraSelections[c.phone] !== undefined,
    );
  }, [intraConflicts, intraSelections]);

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
    setStep(4);
  };

  const handleConfirmIntra = () => {
    const merged = applyIntraFileSelections(rawPreviewRows, intraSelections);
    setResolvedRows(merged);
    setMappingPhase("columns");
    setStep(4);
    toast.success("Conflictos del archivo resueltos. Puedes continuar con la importación.");
  };

  const runDuplicateCheckAndImport = async () => {
    if (activeRows.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }

    setIsCheckingDuplicates(true);
    try {
      const dupes = await checkImportDuplicates(activeRows);
      if (dupes.duplicateCount > 0) {
        setDuplicateCount(dupes.duplicateCount);
        setDuplicateOpen(true);
        return;
      }
      importMutation.mutate("skip");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al validar duplicados.",
      );
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleConfirmDuplicates = () => {
    setDuplicateOpen(false);
    importMutation.mutate(duplicateStrategy);
  };

  const isBusy = isParsing || importMutation.isPending || isCheckingDuplicates;

  const displayStep = step;

  return (
    <>
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
                            intraSelections[conflict.phone] ===
                            candidate.sourceIndex
                          }
                          onSelect={() =>
                            setIntraSelections((prev) => ({
                              ...prev,
                              [conflict.phone]: candidate.sourceIndex,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {step === 4 && parsed && (
              <div className="max-w-lg mx-auto space-y-6 text-center py-8">
                {isCheckingDuplicates ? (
                  <Loader2 className="h-14 w-14 animate-spin text-primary mx-auto" />
                ) : (
                  <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
                )}
                <div>
                  <h3 className="text-lg font-semibold">Listo para importar</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {isCheckingDuplicates
                      ? "Validando duplicados contra la base de datos…"
                      : "Se contrastarán teléfonos y correos existentes antes de persistir."}
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
                onClick={() => {
                  if (step === 4) {
                    setStep(intraConflicts.length > 0 ? 3 : 2);
                    return;
                  }
                  if (step === 3) {
                    setMappingPhase("columns");
                    setStep(2);
                    return;
                  }
                  setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s));
                }}
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
                Continuar
              </Button>
            )}
            {step === 3 && mappingPhase === "intra" && (
              <Button
                type="button"
                onClick={handleConfirmIntra}
                disabled={!allIntraResolved || isBusy}
                className="bg-primary hover:bg-primary/90"
              >
                Confirmar selección
              </Button>
            )}
            {step === 4 && (
              <Button
                type="button"
                onClick={() => void runDuplicateCheckAndImport()}
                disabled={isBusy || activeRows.length === 0}
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

      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Duplicados en base de datos
            </DialogTitle>
            <DialogDescription>
              Se detectaron{" "}
              <strong className="text-foreground">{duplicateCount}</strong>{" "}
              registro{duplicateCount === 1 ? "" : "s"} que ya existen (teléfono
              o correo en Supabase).
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={duplicateStrategy}
            onValueChange={(v) =>
              setDuplicateStrategy(v as DuplicateResolution)
            }
            className="gap-3 py-2"
          >
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <RadioGroupItem value="skip" id="dup-skip" className="mt-0.5" />
              <Label htmlFor="dup-skip" className="cursor-pointer space-y-1">
                <span className="font-medium">Omitir</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Consulta teléfonos existentes y hace insert solo de registros
                  nuevos.
                </p>
              </Label>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <RadioGroupItem
                value="overwrite"
                id="dup-overwrite"
                className="mt-0.5"
              />
              <Label htmlFor="dup-overwrite" className="cursor-pointer space-y-1">
                <span className="font-medium">Sobrescribir</span>
                <p className="text-xs text-muted-foreground font-normal">
                  Upsert masivo por teléfono ({`onConflict: 'phone'`}) para
                  actualizar sin error 409.
                </p>
              </Label>
            </div>
          </RadioGroup>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDuplicateOpen(false)}
              disabled={importMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDuplicates}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando…
                </>
              ) : (
                "Confirmar e importar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
