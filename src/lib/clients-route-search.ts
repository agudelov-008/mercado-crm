import { z } from "zod";
import {
  CLIENT_PAGE_SIZE_OPTIONS,
  type ClientPageSize,
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
});

export type ClientsIndexSearch = z.infer<typeof clientsIndexSearchSchema>;

export const DEFAULT_CLIENTS_PAGE_SIZE: ClientPageSize = 24;

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
