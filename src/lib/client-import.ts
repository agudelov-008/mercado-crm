import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { normalizeLeadStatus, type LeadStatus } from "@/lib/secure-clients";

export type ImportableClientField =
  | "first_name"
  | "last_name"
  | "country"
  | "affiliate"
  | "tp_account"
  | "phone"
  | "email"
  | "lead_status"
  | "owner_id";

export interface ImportableFieldDef {
  key: ImportableClientField;
  label: string;
  required: boolean;
}

export const IMPORTABLE_CLIENT_FIELDS: ImportableFieldDef[] = [
  { key: "first_name", label: "First Name", required: false },
  { key: "last_name", label: "Last Name", required: false },
  { key: "country", label: "Country", required: false },
  { key: "affiliate", label: "Affiliate", required: false },
  { key: "tp_account", label: "TP Account", required: false },
  { key: "phone", label: "Phone", required: true },
  { key: "email", label: "Email", required: false },
  { key: "lead_status", label: "Lead Status", required: false },
  { key: "owner_id", label: "Owner", required: false },
];

export type ColumnMapping = Partial<Record<ImportableClientField, string>>;

export type DuplicateResolution = "skip" | "overwrite";

export interface ParsedSpreadsheet {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
}

/** Payload enviado a Supabase (sin metadatos de UI). */
export interface DbClientRow {
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  affiliate: string | null;
  tp_account: string | null;
  phone: string;
  email: string | null;
  lead_status: LeadStatus;
  owner_id: string | null;
}

/** Fila en memoria con metadatos para resolución de duplicados intra-archivo. */
export interface ClientImportRow extends DbClientRow {
  sourceIndex: number;
  excelRowNumber: number;
}

export interface IntraFileConflict {
  phone: string;
  candidates: ClientImportRow[];
}

export interface DuplicateCheckResult {
  duplicateCount: number;
  duplicatePhones: Set<string>;
  duplicateEmails: Set<string>;
  existingPhones: Set<string>;
}

export interface BulkImportResult {
  inserted: number;
  updated: number;
  skipped: number;
}

const CHUNK_SIZE = 200;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function sanitizeOwnerId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !UUID_REGEX.test(trimmed)) return null;
  return trimmed;
}

/** Normaliza tipos antes de insert/upsert para evitar rechazos 400 de PostgreSQL. */
export function sanitizeDbClientRow(row: DbClientRow): DbClientRow {
  const emailRaw = row.email ? normalizeEmail(row.email) : "";

  return {
    phone: normalizePhone(row.phone),
    first_name: emptyToNull(row.first_name),
    last_name: emptyToNull(row.last_name),
    country: emptyToNull(row.country),
    affiliate: emptyToNull(row.affiliate),
    tp_account: emptyToNull(row.tp_account),
    email: emailRaw === "" ? null : emailRaw,
    lead_status: normalizeLeadStatus(row.lead_status),
    owner_id: sanitizeOwnerId(row.owner_id),
  };
}

export function sanitizeClientImportRow(row: ClientImportRow): ClientImportRow {
  const db = sanitizeDbClientRow(row);
  return { ...db, sourceIndex: row.sourceIndex, excelRowNumber: row.excelRowNumber };
}

function toDbPayload(rows: ClientImportRow[]): DbClientRow[] {
  return rows.map((row) => sanitizeDbClientRow(row));
}

const HEADER_ALIASES: Record<ImportableClientField, string[]> = {
  first_name: ["first name", "firstname", "nombre", "first_name"],
  last_name: ["last name", "lastname", "apellido", "last_name"],
  country: ["country", "pais", "país", "nation"],
  affiliate: ["affiliate", "afiliado", "partner", "empresa"],
  tp_account: ["tp account", "tp_account", "account", "cuenta"],
  phone: ["phone", "telefono", "teléfono", "mobile", "celular", "tel"],
  email: ["email", "correo", "e-mail", "mail"],
  lead_status: ["lead status", "lead_status", "status", "estado"],
  owner_id: ["owner", "owner_id", "agent", "assigned", "propietario"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isAcceptedImportFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".csv") || name.endsWith(".xls");
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("El archivo no contiene hojas de cálculo.");
    }

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    if (matrix.length === 0) {
      throw new Error("El archivo está vacío.");
    }

    const headerRow = matrix[0] ?? [];
    const headers = headerRow.map((cell, index) => {
      const label = cellToString(cell);
      return label || `Columna ${index + 1}`;
    });

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < matrix.length; i += 1) {
      const rowCells = matrix[i] ?? [];
      const record: Record<string, string> = {};
      let hasValue = false;

      headers.forEach((header, colIndex) => {
        const value = cellToString(rowCells[colIndex]);
        if (value) hasValue = true;
        record[header] = value;
      });

      if (hasValue) rows.push(record);
    }

    return { fileName: file.name, headers, rows };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo leer el archivo.";
    throw new Error(message);
  }
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: normalizeHeader(h),
  }));

  for (const field of IMPORTABLE_CLIENT_FIELDS) {
    const aliases = HEADER_ALIASES[field.key];
    const match = normalizedHeaders.find(({ normalized }) =>
      aliases.some((alias) => normalized === alias || normalized.includes(alias)),
    );
    if (match) {
      mapping[field.key] = match.original;
    }
  }

  return mapping;
}

export function buildImportRows(
  parsed: ParsedSpreadsheet,
  mapping: ColumnMapping,
  options: {
    forcedAffiliate: string | null;
    defaultAffiliate: string | null;
  },
): ClientImportRow[] {
  const result: ClientImportRow[] = [];

  for (let excelIndex = 0; excelIndex < parsed.rows.length; excelIndex += 1) {
    const rawRow = parsed.rows[excelIndex];
    const getMapped = (field: ImportableClientField): string => {
      const header = mapping[field];
      if (!header) return "";
      return rawRow[header] ?? "";
    };

    const phone = normalizePhone(getMapped("phone"));
    if (!phone) continue;

    const rowAffiliate =
      options.forcedAffiliate?.trim() ||
      getMapped("affiliate").trim() ||
      options.defaultAffiliate?.trim() ||
      "";

    const sourceIndex = result.length;
    result.push(
      sanitizeClientImportRow({
        first_name: getMapped("first_name"),
        last_name: getMapped("last_name"),
        country: getMapped("country"),
        affiliate: rowAffiliate,
        tp_account: getMapped("tp_account"),
        phone,
        email: getMapped("email"),
        lead_status: normalizeLeadStatus(getMapped("lead_status")),
        owner_id: getMapped("owner_id"),
        sourceIndex,
        excelRowNumber: excelIndex + 2,
      }),
    );
  }

  return result;
}

/** Agrupa teléfonos repetidos dentro del mismo archivo Excel. */
export function detectIntraFileDuplicates(
  rows: ClientImportRow[],
): IntraFileConflict[] {
  const byPhone = new Map<string, ClientImportRow[]>();

  for (const row of rows) {
    const group = byPhone.get(row.phone) ?? [];
    group.push(row);
    byPhone.set(row.phone, group);
  }

  const conflicts: IntraFileConflict[] = [];
  for (const [phone, candidates] of byPhone) {
    if (candidates.length > 1) {
      conflicts.push({ phone, candidates });
    }
  }

  return conflicts.sort((a, b) => a.phone.localeCompare(b.phone));
}

/** Conserva solo la fila elegida por teléfono en conflicto. */
export function applyIntraFileSelections(
  rows: ClientImportRow[],
  selections: Record<string, number>,
): ClientImportRow[] {
  const conflictPhones = new Set(Object.keys(selections));

  return rows
    .filter((row) => {
      if (!conflictPhones.has(row.phone)) return true;
      return selections[row.phone] === row.sourceIndex;
    })
    .map((row, index) => ({ ...row, sourceIndex: index }));
}

export function getDefaultIntraSelections(
  conflicts: IntraFileConflict[],
): Record<string, number> {
  const selections: Record<string, number> = {};
  for (const conflict of conflicts) {
    selections[conflict.phone] = conflict.candidates[0]?.sourceIndex ?? 0;
  }
  return selections;
}

export async function fetchExistingPhones(phones: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (phones.length === 0) return found;

  for (let i = 0; i < phones.length; i += CHUNK_SIZE) {
    const chunk = phones.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("clients")
      .select("phone")
      .in("phone", chunk);

    if (error) throw error;
    for (const row of data ?? []) {
      if (row.phone) found.add(normalizePhone(String(row.phone)));
    }
  }
  return found;
}

async function fetchExistingByEmails(emails: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (emails.length === 0) return found;

  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("clients")
      .select("email")
      .in("email", chunk);

    if (error) throw error;
    for (const row of data ?? []) {
      if (row.email) found.add(normalizeEmail(row.email));
    }
  }
  return found;
}

export async function checkImportDuplicates(
  rows: ClientImportRow[],
): Promise<DuplicateCheckResult> {
  try {
    const phones = [...new Set(rows.map((r) => r.phone))];
    const emails = [
      ...new Set(
        rows
          .map((r) => (r.email ? normalizeEmail(r.email) : ""))
          .filter(Boolean),
      ),
    ];

    const [existingPhones, existingEmails] = await Promise.all([
      fetchExistingPhones(phones),
      fetchExistingByEmails(emails),
    ]);

    const duplicatePhones = new Set<string>();
    const duplicateEmails = new Set<string>();

    for (const row of rows) {
      if (existingPhones.has(row.phone)) {
        duplicatePhones.add(row.phone);
      }
      if (row.email && existingEmails.has(normalizeEmail(row.email))) {
        duplicateEmails.add(normalizeEmail(row.email));
      }
    }

    const duplicateCount = rows.filter(
      (row) =>
        duplicatePhones.has(row.phone) ||
        (row.email ? duplicateEmails.has(normalizeEmail(row.email)) : false),
    ).length;

    return {
      duplicateCount,
      duplicatePhones,
      duplicateEmails,
      existingPhones,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo validar duplicados en la base de datos.";
    throw new Error(message);
  }
}

async function insertChunk(rows: DbClientRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("clients").insert(rows);
  if (error) throw error;
}

async function upsertChunk(rows: DbClientRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("clients")
    .upsert(rows, { onConflict: "phone" });
  if (error) throw error;
}

export async function bulkImportClients(
  rows: ClientImportRow[],
  strategy: DuplicateResolution,
): Promise<BulkImportResult> {
  try {
    const payload = toDbPayload(rows);
    if (payload.length === 0) {
      return { inserted: 0, updated: 0, skipped: 0 };
    }

    const phones = [...new Set(payload.map((r) => r.phone))];
    const existingPhones = await fetchExistingPhones(phones);

    if (strategy === "overwrite") {
      let updated = 0;
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        await upsertChunk(chunk);
        updated += chunk.length;
      }
      return { inserted: 0, updated, skipped: 0 };
    }

    const toInsert = payload.filter((row) => !existingPhones.has(row.phone));
    const skipped = payload.length - toInsert.length;

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      await insertChunk(chunk);
      inserted += chunk.length;
    }

    return { inserted, updated: 0, skipped };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error en la carga masiva de clientes.";
    throw new Error(message);
  }
}

export function normalizeClientPhone(value: string): string {
  return normalizePhone(value);
}

export async function isClientPhoneRegistered(phone: string): Promise<boolean> {
  try {
    const normalized = normalizePhone(phone);
    if (!normalized) return false;
    const existing = await fetchExistingPhones([normalized]);
    return existing.has(normalized);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo verificar el teléfono.";
    throw new Error(message);
  }
}

export interface ProfileAgentOption {
  id: string;
  label: string;
}

export async function fetchAgentProfileOptions(): Promise<ProfileAgentOption[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("role", "Agent")
      .order("first_name", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const profile = row as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string;
      };
      const name = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        id: profile.id,
        label: name || profile.email || profile.id,
      };
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudieron cargar los agentes.";
    throw new Error(message);
  }
}

export async function insertManualClient(row: DbClientRow): Promise<void> {
  try {
    const payload = sanitizeDbClientRow(row);
    const { error } = await supabase.from("clients").insert(payload);
    if (error) throw error;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo crear el cliente.";
    throw new Error(message);
  }
}

/** Resultado de actualizar un cliente (incluye teléfono final tras posible cambio de PK). */
export interface UpdateSecureClientResult {
  phone: string;
  phoneChanged: boolean;
}

/**
 * Actualiza un cliente existente.
 * `originalPhone` filtra el registro; `updates.phone` es el valor nuevo (puede cambiar la PK).
 */
export async function updateSecureClient(
  originalPhone: string,
  updates: DbClientRow,
): Promise<UpdateSecureClientResult> {
  try {
    const normalizedOriginal = normalizePhone(originalPhone);
    if (!normalizedOriginal) {
      throw new Error("Teléfono de cliente inválido.");
    }

    const payload = sanitizeDbClientRow(updates);
    if (!payload.phone) {
      throw new Error("El teléfono es obligatorio.");
    }

    if (payload.phone !== normalizedOriginal) {
      const exists = await isClientPhoneRegistered(payload.phone);
      if (exists) {
        throw new Error(
          "Este número de teléfono ya está registrado en el CRM.",
        );
      }
    }

    const { error } = await supabase
      .from("clients")
      .update(payload)
      .eq("phone", normalizedOriginal);

    if (error) {
      throw new Error(
        error.message.includes("lead_status")
          ? `${error.message} (valor enviado: "${payload.lead_status}")`
          : error.message,
      );
    }

    return {
      phone: payload.phone,
      phoneChanged: payload.phone !== normalizedOriginal,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo actualizar el cliente.";
    throw new Error(message);
  }
}

export async function fetchAffiliateOptions(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("affiliates")
      .select("name")
      .order("name", { ascending: true });

    if (error) throw error;

    return (data ?? [])
      .map((row) => (row as { name: string }).name?.trim())
      .filter((name): name is string => Boolean(name));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudieron cargar los afiliados.";
    throw new Error(message);
  }
}

export function formatImportRowLabel(row: ClientImportRow): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || row.email || `Fila ${row.excelRowNumber}`;
}
