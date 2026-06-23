import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import {
  formatOwnerDisplayName,
  normalizeLeadStatus,
  normalizeOwnerProfile,
  resolveLeadStatusForOwnerAssignment,
  type LeadStatus,
  type SecureClientOwnerProfile,
} from "@/lib/secure-clients";

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

/** Decisión por teléfono al resolver un duplicado contra el CRM. */
export type PerDuplicateResolution = "skip" | "overwrite";

/** Cliente existente en Supabase (snapshot para comparar con el Excel). */
export interface ExistingClientSnapshot {
  phone: string;
  first_name: string | null;
  last_name: string | null;
  lead_status: string | null;
  affiliate: string | null;
  email: string | null;
  owner_name: string | null;
  owner: SecureClientOwnerProfile | null;
}

/** Error cuando Postgres rechaza un INSERT por teléfono duplicado (23505). */
export class ImportDuplicateKeyError extends Error {
  readonly phones: string[];

  constructor(message: string, phones: string[]) {
    super(message);
    this.name = "ImportDuplicateKeyError";
    this.phones = phones;
  }
}

/** Conflicto entre una fila del Excel y un cliente ya persistido. */
export interface CrmDuplicateConflict {
  phone: string;
  excelRow: ClientImportRow;
  existing: ExistingClientSnapshot;
}

/** Resultado de separar el lote en nuevos registros y duplicados del CRM. */
export interface ImportPartitionResult {
  nuevosClientes: ClientImportRow[];
  clientesDuplicados: CrmDuplicateConflict[];
}

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
  /** Actualizaciones bloqueadas por RLS u otro error individual. */
  denied: number;
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
  const owner_id = sanitizeOwnerId(row.owner_id);
  const autoLeadStatus = resolveLeadStatusForOwnerAssignment(owner_id);

  return {
    phone: normalizePhone(row.phone),
    first_name: emptyToNull(row.first_name),
    last_name: emptyToNull(row.last_name),
    country: emptyToNull(row.country),
    affiliate: emptyToNull(row.affiliate),
    tp_account: emptyToNull(row.tp_account),
    email: emailRaw === "" ? null : emailRaw,
    lead_status: autoLeadStatus ?? normalizeLeadStatus(row.lead_status),
    owner_id,
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
    if (Number.isInteger(value)) {
      return String(Math.trunc(value));
    }
    return String(value);
  }
  return String(value).trim();
}

/** Clave canónica para comparar existencia (solo dígitos). */
export function phoneComparisonKey(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normaliza teléfonos antes de consultar o persistir.
 * Elimina espacios, guiones, paréntesis y puntos; conserva "+" inicial si existe.
 */
function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  return hasLeadingPlus ? `+${digits}` : digits;
}

/** Variantes de un teléfono para maximizar coincidencias en `.in('phone', ...)`. */
function phoneQueryVariants(value: string): string[] {
  const trimmed = value.trim();
  const normalized = normalizePhone(value);
  const variants = new Set<string>();

  if (trimmed) variants.add(trimmed);
  if (normalized) variants.add(normalized);

  const digits = phoneComparisonKey(normalized || trimmed);
  if (digits) {
    variants.add(digits);
    variants.add(`+${digits}`);
  }

  return [...variants];
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Indicativos ordenados de mayor a menor longitud para evitar falsos positivos. */
const PHONE_COUNTRY_PREFIXES: ReadonlyArray<{ prefix: string; country: string }> = [
  { prefix: "593", country: "ecuador Ecuador" },
  { prefix: "591", country: "bolivia Bolivia" },
  { prefix: "504", country: "honduras Honduras" },
  { prefix: "503", country: "salvador El Salvador" },
  { prefix: "502", country: "guatemala Guatemala" },
  { prefix: "52", country: "mx México" },
  { prefix: "51", country: "peru Perú" },
  { prefix: "56", country: "chile Chile" },
  { prefix: "57", country: "co Colombia" },
];

function detectCountryFromPhoneDigits(digits: string): string | null {
  if (!digits) return null;

  for (const { prefix, country } of PHONE_COUNTRY_PREFIXES) {
    if (digits.startsWith(prefix)) return country;
  }

  return null;
}

/** Infiere el país estandarizado a partir del indicativo telefónico. */
export function detectCountryFromPhone(phone: string): string | null {
  return detectCountryFromPhoneDigits(phoneComparisonKey(phone));
}

function resolveImportCountry(
  excelCountry: string | null | undefined,
  phone: string,
): string | null {
  const trimmed = excelCountry?.trim() ?? "";
  if (trimmed) return trimmed;

  return detectCountryFromPhoneDigits(phoneComparisonKey(phone));
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

    const excelCountry = getMapped("country").trim();
    const country = resolveImportCountry(excelCountry, phone);

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
        country,
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

  return dedupeIntraFileByPhone(result);
}

/** Conserva la primera fila por teléfono (clave solo-dígitos) dentro del lote Excel. */
export function dedupeIntraFileByPhone(rows: ClientImportRow[]): ClientImportRow[] {
  const seen = new Set<string>();
  const unique: ClientImportRow[] = [];

  for (const row of rows) {
    const key = phoneComparisonKey(row.phone);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...row, sourceIndex: unique.length });
  }

  return unique;
}

/** Agrupa teléfonos repetidos dentro del mismo archivo Excel. */
export function detectIntraFileDuplicates(
  rows: ClientImportRow[],
): IntraFileConflict[] {
  const byKey = new Map<string, ClientImportRow[]>();

  for (const row of rows) {
    const key = phoneComparisonKey(row.phone);
    if (!key) continue;
    const group = byKey.get(key) ?? [];
    group.push(row);
    byKey.set(key, group);
  }

  const conflicts: IntraFileConflict[] = [];
  for (const [, candidates] of byKey) {
    if (candidates.length > 1) {
      conflicts.push({
        phone: candidates[0]?.phone ?? "",
        candidates,
      });
    }
  }

  return conflicts.sort((a, b) => a.phone.localeCompare(b.phone));
}

/** Conserva solo la fila elegida por teléfono en conflicto. */
export function applyIntraFileSelections(
  rows: ClientImportRow[],
  selections: Record<string, number>,
): ClientImportRow[] {
  const conflictKeys = new Set(Object.keys(selections));

  return dedupeIntraFileByPhone(
    rows.filter((row) => {
      const key = phoneComparisonKey(row.phone);
      if (!conflictKeys.has(key)) return true;
      return selections[key] === row.sourceIndex;
    }),
  );
}

export function getDefaultIntraSelections(
  conflicts: IntraFileConflict[],
): Record<string, number> {
  const selections: Record<string, number> = {};
  for (const conflict of conflicts) {
    const key = phoneComparisonKey(conflict.phone);
    if (!key) continue;
    selections[key] = conflict.candidates[0]?.sourceIndex ?? 0;
  }
  return selections;
}

export interface ExistingPhoneIndex {
  /** Claves solo-dígitos presentes en la BD. */
  comparisonKeys: Set<string>;
  /** Teléfono PK real en BD por clave de comparación. */
  canonicalByKey: Map<string, string>;
}

function mergePhoneIndexes(...indexes: ExistingPhoneIndex[]): ExistingPhoneIndex {
  const comparisonKeys = new Set<string>();
  const canonicalByKey = new Map<string, string>();

  for (const index of indexes) {
    for (const key of index.comparisonKeys) {
      comparisonKeys.add(key);
      const canonical = index.canonicalByKey.get(key);
      if (canonical) canonicalByKey.set(key, canonical);
    }
  }

  return { comparisonKeys, canonicalByKey };
}

async function queryPhoneIndexFromTable(
  table: "clients" | "secure_clients",
  queryVariants: string[],
): Promise<ExistingPhoneIndex> {
  const comparisonKeys = new Set<string>();
  const canonicalByKey = new Map<string, string>();
  if (queryVariants.length === 0) {
    return { comparisonKeys, canonicalByKey };
  }

  for (let i = 0; i < queryVariants.length; i += CHUNK_SIZE) {
    const chunk = queryVariants.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from(table)
      .select("phone")
      .in("phone", chunk);

    if (error) throw error;

    for (const row of data ?? []) {
      if (!row.phone) continue;
      const canonical = String(row.phone);
      const key = phoneComparisonKey(canonical);
      if (!key) continue;
      comparisonKeys.add(key);
      canonicalByKey.set(key, canonical);
    }
  }

  return { comparisonKeys, canonicalByKey };
}

/** Busca teléfonos existentes en `secure_clients` (visible al usuario) y `clients`. */
export async function fetchExistingPhoneIndex(
  phones: string[],
): Promise<ExistingPhoneIndex> {
  if (phones.length === 0) {
    return { comparisonKeys: new Set(), canonicalByKey: new Map() };
  }

  const queryVariants = [
    ...new Set(phones.flatMap((phone) => phoneQueryVariants(phone))),
  ];

  const [secureIndex, clientsIndex] = await Promise.all([
    queryPhoneIndexFromTable("secure_clients", queryVariants),
    queryPhoneIndexFromTable("clients", queryVariants),
  ]);

  return mergePhoneIndexes(secureIndex, clientsIndex);
}

export async function fetchExistingPhones(phones: string[]): Promise<Set<string>> {
  const index = await fetchExistingPhoneIndex(phones);
  return new Set(index.comparisonKeys);
}

function isPhoneRegistered(
  phone: string,
  index: ExistingPhoneIndex,
): boolean {
  const key = phoneComparisonKey(phone);
  return key !== "" && index.comparisonKeys.has(key);
}

type ClientRowWithOwnerJoin = {
  phone: string;
  first_name: string | null;
  last_name: string | null;
  lead_status: string | null;
  affiliate: string | null;
  email: string | null;
  owner_name?: string | null;
  owner?: SecureClientOwnerProfile | SecureClientOwnerProfile[] | null;
};

function mapRowToExistingSnapshot(
  row: ClientRowWithOwnerJoin,
): ExistingClientSnapshot | null {
  if (!row.phone) return null;
  const canonical = String(row.phone);
  const key = phoneComparisonKey(canonical);
  if (!key) return null;

  return {
    phone: canonical,
    first_name: row.first_name,
    last_name: row.last_name,
    lead_status: row.lead_status,
    affiliate: row.affiliate,
    email: row.email,
    owner_name: row.owner_name ?? null,
    owner: normalizeOwnerProfile(row.owner),
  };
}

async function fetchClientSnapshotsFromTable(
  table: "clients" | "secure_clients",
  queryVariants: string[],
): Promise<Map<string, ExistingClientSnapshot>> {
  const found = new Map<string, ExistingClientSnapshot>();
  if (queryVariants.length === 0) return found;

  for (let i = 0; i < queryVariants.length; i += CHUNK_SIZE) {
    const chunk = queryVariants.slice(i, i + CHUNK_SIZE);

    if (table === "secure_clients") {
      const { data, error } = await supabase
        .from("secure_clients")
        .select(
          "phone, first_name, last_name, lead_status, affiliate, email, owner_name",
        )
        .in("phone", chunk);

      if (error) throw error;

      for (const row of data ?? []) {
        const snapshot = mapRowToExistingSnapshot(row as ClientRowWithOwnerJoin);
        if (!snapshot) continue;
        found.set(phoneComparisonKey(snapshot.phone), snapshot);
      }
      continue;
    }

    const { data, error } = await supabase
      .from("clients")
      .select(
        "phone, first_name, last_name, lead_status, affiliate, email, owner:profiles!owner_id(first_name, last_name, email)",
      )
      .in("phone", chunk);

    if (error) throw error;

    for (const row of (data ?? []) as unknown as ClientRowWithOwnerJoin[]) {
      const snapshot = mapRowToExistingSnapshot(row);
      if (!snapshot) continue;
      found.set(phoneComparisonKey(snapshot.phone), snapshot);
    }
  }

  return found;
}

/** Registro devuelto por `check_crm_duplicates_v2` (bypass RLS para existencia global). */
type CrmDuplicateRpcRecord = {
  existing_phone: string;
  first_name?: string | null;
  last_name?: string | null;
  lead_status?: string | null;
  affiliate?: string | null;
  email?: string | null;
  owner_name?: string | null;
};

function mapRpcRecordToSnapshot(rec: CrmDuplicateRpcRecord): ExistingClientSnapshot {
  return {
    phone: rec.existing_phone,
    first_name: rec.first_name ?? null,
    last_name: rec.last_name ?? null,
    lead_status: rec.lead_status ?? null,
    affiliate: rec.affiliate ?? null,
    email: rec.email ?? null,
    owner_name: rec.owner_name ?? null,
    owner: null,
  };
}

/**
 * Consulta existencia real de teléfonos vía RPC (sin filtro RLS por asesor).
 * `digitKeys` deben ser llaves solo-dígitos (`phoneComparisonKey`).
 */
async function fetchExistingClientsByDigitKeys(
  digitKeys: string[],
): Promise<Map<string, ExistingClientSnapshot>> {
  const existingMap = new Map<string, ExistingClientSnapshot>();
  if (digitKeys.length === 0) return existingMap;

  const uniqueKeys = [...new Set(digitKeys)];

  for (let i = 0; i < uniqueKeys.length; i += CHUNK_SIZE) {
    const chunk = uniqueKeys.slice(i, i + CHUNK_SIZE);
    const { data: existingRecords, error } = await supabase.rpc(
      "check_crm_duplicates_v2",
      { digit_keys: chunk },
    );
    if (error) throw error;

    (existingRecords as CrmDuplicateRpcRecord[] | null)?.forEach((rec) => {
      const cleanKey = rec.existing_phone.replace(/\D/g, "");
      if (!cleanKey) return;
      existingMap.set(cleanKey, mapRpcRecordToSnapshot(rec));
    });
  }

  return existingMap;
}

/** Consulta clientes existentes por teléfono con datos para la UI de conflictos. */
export async function fetchExistingClientsByPhones(
  phones: string[],
): Promise<Map<string, ExistingClientSnapshot>> {
  const digitKeys = phones.map((phone) => phoneComparisonKey(phone)).filter(Boolean);
  return fetchExistingClientsByDigitKeys(digitKeys);
}

/** Pre-validación: separa filas nuevas de las que chocan con teléfonos en `clients`. */
export async function partitionImportByExistingClients(
  rows: ClientImportRow[],
): Promise<ImportPartitionResult> {
  try {
    const sanitizedRows = dedupeIntraFileByPhone(
      rows.map((row) => sanitizeClientImportRow(row)),
    );
    const digitKeys = sanitizedRows
      .map((r) => phoneComparisonKey(r.phone))
      .filter(Boolean);
    const existingByKey = await fetchExistingClientsByDigitKeys(digitKeys);

    const nuevosClientes: ClientImportRow[] = [];
    const clientesDuplicados: CrmDuplicateConflict[] = [];
    const seenNewPhones = new Set<string>();

    for (const row of sanitizedRows) {
      const key = phoneComparisonKey(row.phone);
      const existing = existingByKey.get(key);

      if (existing) {
        clientesDuplicados.push({
          phone: row.phone,
          excelRow: row,
          existing,
        });
        continue;
      }

      if (seenNewPhones.has(key)) continue;
      seenNewPhones.add(key);
      nuevosClientes.push(row);
    }

    return { nuevosClientes, clientesDuplicados };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudo validar duplicados en la base de datos.";
    throw new Error(message);
  }
}

export function getDefaultCrmResolutions(
  conflicts: CrmDuplicateConflict[],
): Record<string, PerDuplicateResolution> {
  const resolutions: Record<string, PerDuplicateResolution> = {};
  for (const conflict of conflicts) {
    const key = phoneComparisonKey(conflict.phone);
    if (!key) continue;
    resolutions[key] = "skip";
  }
  return resolutions;
}

function resolveDuplicateAction(
  phone: string,
  resolutions: Record<string, PerDuplicateResolution>,
): PerDuplicateResolution {
  const key = phoneComparisonKey(phone);
  return resolutions[key] ?? resolutions[phone] ?? "skip";
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
      const phoneKey = phoneComparisonKey(row.phone);
      if (phoneKey && existingPhones.has(phoneKey)) {
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

function isRlsPolicyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "42501"
  );
}

async function insertChunk(rows: DbClientRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("clients").insert(rows);
  if (error) throw error;
}

type ClientUpdatePayload = Omit<DbClientRow, "phone">;

function toUpdatePayload(row: DbClientRow): ClientUpdatePayload {
  const { phone: _phone, ...fields } = row;
  return fields;
}

async function updateClientByPhone(
  row: DbClientRow,
  phoneInDb: string,
): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update(toUpdatePayload(row))
    .eq("phone", phoneInDb);

  if (error) throw error;
}

async function upsertChunk(rows: DbClientRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("clients")
    .upsert(rows, { onConflict: "phone" });
  if (error) throw error;
}

/**
 * Importación con resolución granular.
 * - INSERT masivo: solo teléfonos nuevos (pasan RLS de inserción en bloque).
 * - UPDATE individual: duplicados "overwrite" con Promise.allSettled (RLS por fila).
 * - SKIP: excluidos de cualquier llamada a Supabase.
 */
export async function bulkImportWithResolutions(
  nuevosClientes: ClientImportRow[],
  clientesDuplicados: CrmDuplicateConflict[],
  resolutions: Record<string, PerDuplicateResolution>,
): Promise<BulkImportResult> {
  try {
    let skipped = 0;
    const overwriteJobs: Array<{ row: DbClientRow; phoneInDb: string }> = [];

    for (const conflict of clientesDuplicados) {
      const key = phoneComparisonKey(conflict.phone);
      if (!key) {
        skipped += 1;
        continue;
      }

      if (resolveDuplicateAction(conflict.phone, resolutions) === "overwrite") {
        overwriteJobs.push({
          row: sanitizeDbClientRow(conflict.excelRow),
          phoneInDb: conflict.existing.phone,
        });
      } else {
        skipped += 1;
      }
    }

    const overwriteKeys = new Set(
      overwriteJobs.map((job) => phoneComparisonKey(job.phoneInDb)),
    );
    const insertByKey = new Map<string, DbClientRow>();

    for (const row of nuevosClientes) {
      const sanitized = sanitizeDbClientRow(row);
      const key = phoneComparisonKey(sanitized.phone);
      if (!key || overwriteKeys.has(key) || insertByKey.has(key)) continue;
      insertByKey.set(key, sanitized);
    }

    const toInsert = [...insertByKey.values()];
    let inserted = 0;

    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      await insertChunk(chunk);
      inserted += chunk.length;
    }

    let updated = 0;
    let denied = 0;

    if (overwriteJobs.length > 0) {
      const results = await Promise.allSettled(
        overwriteJobs.map(({ row, phoneInDb }) =>
          updateClientByPhone(row, phoneInDb),
        ),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          updated += 1;
          continue;
        }

        denied += 1;
        if (!isRlsPolicyError(result.reason)) {
          const message =
            result.reason instanceof Error
              ? result.reason.message
              : "Error al actualizar un cliente duplicado.";
          if (import.meta.env.DEV) {
            console.warn("[import] actualización rechazada:", message);
          }
        }
      }
    }

    return { inserted, updated, skipped, denied };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error en la carga masiva de clientes.";
    throw new Error(message);
  }
}

export async function bulkImportClients(
  rows: ClientImportRow[],
  strategy: DuplicateResolution,
): Promise<BulkImportResult> {
  try {
    const payload = toDbPayload(rows);
    if (payload.length === 0) {
      return { inserted: 0, updated: 0, skipped: 0, denied: 0 };
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
      return { inserted: 0, updated, skipped: 0, denied: 0 };
    }

    const toInsert = payload.filter(
      (row) => !existingPhones.has(phoneComparisonKey(row.phone)),
    );
    const skipped = payload.length - toInsert.length;

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      await insertChunk(chunk);
      inserted += chunk.length;
    }

    return { inserted, updated: 0, skipped, denied: 0 };
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
    const index = await fetchExistingPhoneIndex([normalized]);
    return isPhoneRegistered(normalized, index);
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

export function formatExistingClientLabel(client: ExistingClientSnapshot): string {
  const name = [client.first_name, client.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || client.email || client.phone;
}

export function formatImportOwnerLabel(row: ClientImportRow): string {
  if (!row.owner_id) return "Sin asignar";
  return row.owner_id;
}

export function formatExistingOwnerLabel(client: ExistingClientSnapshot): string {
  const fromProfile = formatOwnerDisplayName(client.owner);
  if (fromProfile !== "Sin asignar") return fromProfile;
  return client.owner_name?.trim() || "Sin asignar";
}
