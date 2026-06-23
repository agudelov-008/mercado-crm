import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  encodeClientsListReturnContext,
  pickClientsListReturnSearch,
  resolveClientsListReturnContext,
  type ClientsListReturnContext,
} from "@/lib/clients-route-search";
import { useAuth } from "@/lib/auth-context";
import { useApp } from "@/lib/app-context";
import {
  clientDetailIdFromPhone,
  fetchSecureClients,
  fetchSecureClientsByOwnerId,
  type SecureClientWithOwners,
  type SecureClientsPageResult,
} from "@/lib/secure-clients";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function resolveClientDisplayName(client: SecureClientWithOwners): string {
  return (
    [client.first_name, client.last_name].filter(Boolean).join(" ").trim() ||
    client.phone
  );
}

async function fetchClientsPageForNav(
  isAgent: boolean,
  profileId: string | undefined,
  context: ClientsListReturnContext,
  pageIndex: number,
): Promise<SecureClientsPageResult> {
  const pagination = { page: pageIndex, pageSize: context.pageSize };
  const globalSearch = context.search?.trim() || undefined;

  if (isAgent && profileId) {
    return fetchSecureClientsByOwnerId(
      profileId,
      context.filters,
      context.sort,
      pagination,
      globalSearch,
    );
  }

  return fetchSecureClients(
    context.filters,
    context.sort,
    pagination,
    globalSearch,
  );
}

interface ClientPageNavColumnProps {
  currentPhone: string;
  search: Record<string, unknown>;
}

export function ClientPageNavColumn({
  currentPhone,
  search,
}: ClientPageNavColumnProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { profileRole } = useApp();
  const activeItemRef = useRef<HTMLButtonElement>(null);

  const profileId = user?.id;
  const isProfileReady = !!profileId && profileRole !== null && !isAuthLoading;
  const isAgent = profileRole === "Agent";

  const listContext = useMemo(
    () => resolveClientsListReturnContext(search),
    [search],
  );

  const pageIndex = Math.max(0, listContext.page - 1);

  const queryKey = useMemo(
    () =>
      [
        "client-page-nav",
        profileId,
        listContext.page,
        listContext.pageSize,
        listContext.filters,
        listContext.sort,
        listContext.search,
      ] as const,
    [profileId, listContext],
  );

  const { data, isPending, isError } = useQuery({
    queryKey,
    queryFn: () =>
      fetchClientsPageForNav(isAgent, profileId, listContext, pageIndex),
    enabled: isProfileReady,
    staleTime: 60_000,
  });

  const clients = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / listContext.pageSize));

  const currentIndex = clients.findIndex((client) => client.phone === currentPhone);
  const hasCurrentInList = currentIndex >= 0;

  const canGoPrevious = hasCurrentInList && (currentIndex > 0 || listContext.page > 1);
  const canGoNext =
    hasCurrentInList &&
    (currentIndex < clients.length - 1 || listContext.page < totalPages);

  useEffect(() => {
    if (!hasCurrentInList) return;
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentPhone, clients, hasCurrentInList]);

  const navigateToClient = useCallback(
    (phone: string, nextContext: ClientsListReturnContext) => {
      void navigate({
        to: "/clients/$id",
        params: { id: clientDetailIdFromPhone(phone) },
        search: () => ({
          ...pickClientsListReturnSearch(search),
          listCtx: encodeClientsListReturnContext(nextContext),
        }),
      });
    },
    [navigate, search],
  );

  const goToAdjacentClient = useCallback(
    async (direction: "prev" | "next") => {
      if (!hasCurrentInList) return;

      if (direction === "prev" && currentIndex > 0) {
        navigateToClient(clients[currentIndex - 1].phone, listContext);
        return;
      }

      if (direction === "next" && currentIndex < clients.length - 1) {
        navigateToClient(clients[currentIndex + 1].phone, listContext);
        return;
      }

      const targetPage =
        direction === "prev" ? listContext.page - 1 : listContext.page + 1;
      if (targetPage < 1 || targetPage > totalPages) return;

      const targetPageIndex = targetPage - 1;
      const result = await queryClient.fetchQuery({
        queryKey: [
          "client-page-nav",
          profileId,
          targetPage,
          listContext.pageSize,
          listContext.filters,
          listContext.sort,
          listContext.search,
        ],
        queryFn: () =>
          fetchClientsPageForNav(
            isAgent,
            profileId,
            listContext,
            targetPageIndex,
          ),
        staleTime: 60_000,
      });

      const targetRows = result.rows;
      if (targetRows.length === 0) return;

      const targetClient =
        direction === "prev"
          ? targetRows[targetRows.length - 1]
          : targetRows[0];

      const nextTotalPages = Math.max(
        1,
        Math.ceil(result.totalCount / listContext.pageSize),
      );

      navigateToClient(targetClient.phone, {
        ...listContext,
        page: targetPage,
        totalPages: nextTotalPages,
      });
    },
    [
      clients,
      currentIndex,
      hasCurrentInList,
      isAgent,
      listContext,
      navigateToClient,
      profileId,
      queryClient,
      totalPages,
    ],
  );

  if (!isProfileReady) return null;

  return (
    <aside className="hidden lg:flex w-56 xl:w-60 shrink-0 h-full flex-col overflow-hidden border-r border-border bg-surface/30">
      <div className="px-3 py-3 border-b border-border shrink-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Clientes
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
          Página {listContext.page} de {totalPages}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-2">
        {isPending ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError ? (
          <p className="px-2 py-4 text-xs text-destructive">
            No se pudo cargar la lista.
          </p>
        ) : clients.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            Sin clientes en esta página.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {clients.map((client) => {
              const isActive = client.phone === currentPhone;
              const name = resolveClientDisplayName(client);

              return (
                <li key={client.phone}>
                  <button
                    ref={isActive ? activeItemRef : undefined}
                    type="button"
                    onClick={() => navigateToClient(client.phone, listContext)}
                    className={cn(
                      "w-full text-left rounded-md px-2.5 py-2 text-sm transition-colors truncate",
                      isActive
                        ? "bg-primary/15 text-foreground border border-primary/30 font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated",
                    )}
                    title={name}
                  >
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-2 shrink-0 flex flex-row gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 justify-center gap-1 text-xs px-2"
          disabled={!canGoPrevious || isPending}
          title="Cliente anterior"
          onClick={() => void goToAdjacentClient("prev")}
        >
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Anterior</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 justify-center gap-1 text-xs px-2"
          disabled={!canGoNext || isPending}
          title="Cliente siguiente"
          onClick={() => void goToAdjacentClient("next")}
        >
          <span className="truncate">Siguiente</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </Button>
      </div>
    </aside>
  );
}
