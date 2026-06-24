import { z } from "zod";
import {
  CLIENT_PAGE_SIZE_OPTIONS,
  EMPTY_FILTERS,
  type ClientPageSize,
  type SecureClientFilters,
  type SecureClientSort,
} from "@/lib/secure-clients";

const clientPageSizeSchema = z.coerce
  .number()
  .int()
  .refine(
    (value): value is ClientPageSize =>
      (CLIENT_PAGE_SIZE_OPTIONS as readonly number[]).includes(value),
  )
  .default(24);

export const clientsIndexSearchSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: clientPageSizeSchema,
  ctx: z.string().optional(),
});

export type ClientsIndexSearch = z.infer<typeof clientsIndexSearchSchema>;

export const DEFAULT_CLIENTS_PAGE_SIZE: ClientPageSize = 24;

const selectFilterValuesSchema = z.preprocess(
  (value) => {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string");
    }
    if (typeof value === "string" && value.trim()) {
      return [value.trim()];
    }
    return [];
  },
  z.array(z.string()),
);

const secureClientFiltersSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  country: selectFilterValuesSchema,
  affiliate: selectFilterValuesSchema,
  tp_account: z.string(),
  phone: z.string(),
  email: z.string(),
  lead_status: selectFilterValuesSchema,
  owner_name: selectFilterValuesSchema,
  total_calls: z.string(),
  previous_lead_status: selectFilterValuesSchema,
  previous_owner_name: selectFilterValuesSchema,
  created_on: z.string(),
  last_assignment: z.string(),
  last_contacted: z.string(),
  updated_at: z.string(),
}) satisfies z.ZodType<SecureClientFilters>;

const secureClientSortSchema = z
  .object({
    column: z.string(),
    direction: z.enum(["asc", "desc"]),
  })
  .nullable();

export const clientsListReturnContextSchema = z.object({
  page: z.number().int().min(1),
  pageSize: clientPageSizeSchema,
  search: z.string().optional(),
  filters: secureClientFiltersSchema,
  sort: secureClientSortSchema,
  totalPages: z.number().int().min(1),
});

export type ClientsListReturnContext = {
  page: number;
  pageSize: ClientPageSize;
  search?: string;
  filters: SecureClientFilters;
  sort: SecureClientSort | null;
  totalPages: number;
};

export function clientsPageIndexFromSearch(search: ClientsIndexSearch): number {
  return Math.max(0, search.page - 1);
}

export function clientsPageSizeFromSearch(search: ClientsIndexSearch): ClientPageSize {
  return search.pageSize;
}

export function mergeClientsIndexSearch(
  prev: Record<string, unknown>,
  patch: Partial<ClientsIndexSearch>,
): Partial<ClientsIndexSearch> {
  const merged: ClientsIndexSearch = {
    ...clientsIndexSearchSchema.parse(prev),
    ...patch,
  };
  const trimmedSearch = merged.search?.trim();

  return {
    search: trimmedSearch || undefined,
    page: merged.page > 1 ? merged.page : undefined,
    pageSize:
      merged.pageSize !== DEFAULT_CLIENTS_PAGE_SIZE ? merged.pageSize : undefined,
    ctx: merged.ctx || undefined,
  };
}

export const CLIENTS_INDEX_PATH = "/clients";

export function isClientsIndexPath(pathname: string): boolean {
  return pathname === CLIENTS_INDEX_PATH || pathname === `${CLIENTS_INDEX_PATH}/`;
}

export function isClientDetailPath(pathname: string): boolean {
  return (
    pathname.startsWith("/clients/") &&
    !isClientsIndexPath(pathname)
  );
}

export function readClientsIndexSearch(
  search: Record<string, unknown>,
): string {
  return typeof search.search === "string" ? search.search : "";
}

export const clientsListReturnSearchSchema = z.object({
  listCtx: z.string().optional(),
  listPage: z.coerce.number().int().min(1).optional(),
  listPageSize: clientPageSizeSchema.optional(),
  listSearch: z.string().optional(),
});

export type ClientsListReturnSearch = z.infer<typeof clientsListReturnSearchSchema>;

export const clientDetailSearchSchema = clientsListReturnSearchSchema.extend({
  edit: z.enum(["1", "true"]).optional(),
  search: z.string().optional(),
  q: z.string().optional(),
});

export type ClientDetailSearch = z.infer<typeof clientDetailSearchSchema>;

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding =
      normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const binary = atob(normalized + padding);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeClientsListReturnContext(
  context: ClientsListReturnContext,
): string {
  return encodeBase64Url(JSON.stringify(context));
}

export function decodeClientsListReturnContext(
  encoded: string,
): ClientsListReturnContext | null {
  const json = decodeBase64Url(encoded);
  if (!json) return null;

  try {
    const parsed = clientsListReturnContextSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return null;

    return {
      ...parsed.data,
      sort: parsed.data.sort as SecureClientSort | null,
    };
  } catch {
    return null;
  }
}

export function buildClientsListReturnContext(input: {
  search: ClientsIndexSearch;
  filters: SecureClientFilters;
  sort: SecureClientSort | null;
  totalPages: number;
}): ClientsListReturnContext {
  const trimmedSearch = input.search.search?.trim();

  return {
    page: input.search.page,
    pageSize: input.search.pageSize,
    search: trimmedSearch || undefined,
    filters: input.filters,
    sort: input.sort,
    totalPages: Math.max(1, input.totalPages),
  };
}

export function clientsListReturnSearchFromIndex(input: {
  search: ClientsIndexSearch;
  filters: SecureClientFilters;
  sort: SecureClientSort | null;
  totalPages: number;
}): Partial<ClientsListReturnSearch> {
  return {
    listCtx: encodeClientsListReturnContext(buildClientsListReturnContext(input)),
  };
}

export function defaultClientsListReturnContext(): ClientsListReturnContext {
  return {
    page: 1,
    pageSize: DEFAULT_CLIENTS_PAGE_SIZE,
    filters: EMPTY_FILTERS,
    sort: null,
    totalPages: 1,
  };
}

export function resolveClientsListReturnContext(
  search: Record<string, unknown>,
): ClientsListReturnContext {
  return readClientsListReturnContext(search) ?? defaultClientsListReturnContext();
}

export function readClientsListReturnContext(
  search: Record<string, unknown>,
): ClientsListReturnContext | null {
  if (typeof search.listCtx === "string") {
    return decodeClientsListReturnContext(search.listCtx);
  }

  const parsed = clientsListReturnSearchSchema.safeParse(search);
  if (!parsed.success) return null;

  const { listPage, listPageSize, listSearch } = parsed.data;
  if (!listPage && !listPageSize && !listSearch) return null;

  return {
    page: listPage ?? 1,
    pageSize: listPageSize ?? DEFAULT_CLIENTS_PAGE_SIZE,
    search: listSearch?.trim() || undefined,
    filters: EMPTY_FILTERS,
    sort: null,
    totalPages: listPage ?? 1,
  };
}

export function clientsIndexSearchFromReturnContext(
  context: ClientsListReturnContext,
  targetPage: number,
): Partial<ClientsIndexSearch> {
  const page = Math.max(1, Math.min(targetPage, context.totalPages));
  const trimmedSearch = context.search?.trim();
  const nextContext: ClientsListReturnContext = { ...context, page };

  return {
    ...mergeClientsIndexSearch(
      {},
      {
        page,
        pageSize: context.pageSize,
        search: trimmedSearch || undefined,
      },
    ),
    ctx: encodeClientsListReturnContext(nextContext),
  };
}

/** @deprecated Use clientsIndexSearchFromReturnContext */
export function clientsIndexSearchFromListReturn(
  returnSearch: Partial<ClientsListReturnSearch>,
): Partial<ClientsIndexSearch> {
  const context = readClientsListReturnContext(returnSearch);
  if (!context) return mergeClientsIndexSearch({}, {});
  return clientsIndexSearchFromReturnContext(context, context.page);
}

export function pickClientsListReturnSearch(
  search: Record<string, unknown>,
): Partial<ClientsListReturnSearch> {
  const parsed = clientsListReturnSearchSchema.safeParse(search);
  if (!parsed.success) return {};

  const { listCtx } = parsed.data;
  return listCtx ? { listCtx } : {};
}
