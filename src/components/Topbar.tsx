import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, LogOut } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { BRAND_LOGO_SOLO, BRAND_NAME } from "@/lib/brand";
import {
  isClientDetailPath,
  isClientsIndexPath,
  mergeClientsIndexSearch,
  readClientsIndexSearch,
} from "@/lib/clients-route-search";
import { getProfileRoleLabel } from "@/lib/role-rbac";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

const GLOBAL_SEARCH_DEBOUNCE_MS = 300;

export function Topbar() {
  const { profileRole, currentUser } = useApp();
  const { handleLogout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const urlSearchTerm = useRouterState({
    select: (state) =>
      isClientsIndexPath(state.location.pathname)
        ? readClientsIndexSearch(
            state.location.search as Record<string, unknown>,
          )
        : null,
  });

  const [inputValue, setInputValue] = useState("");
  const debouncedSearch = useDebouncedValue(inputValue, GLOBAL_SEARCH_DEBOUNCE_MS);
  const isOnClientsIndex = isClientsIndexPath(pathname);
  const isOnClientDetail = isClientDetailPath(pathname);
  const isUserTypingRef = useRef(false);

  const roleLabel =
    profileRole !== null ? getProfileRoleLabel(profileRole) : "…";

  // Sync input from URL only on the clients list route.
  useEffect(() => {
    if (!isOnClientsIndex || urlSearchTerm === null) return;
    isUserTypingRef.current = false;
    setInputValue(urlSearchTerm);
  }, [urlSearchTerm, isOnClientsIndex]);

  // Push debounced input to URL only when the user is actively typing.
  useEffect(() => {
    if (isOnClientDetail || !isUserTypingRef.current) return;

    const trimmed = debouncedSearch.trim();

    if (isOnClientsIndex) {
      const current = (urlSearchTerm ?? "").trim();
      if (trimmed === current) {
        isUserTypingRef.current = false;
        return;
      }

      void navigate({
        to: "/clients",
        search: (prev) =>
          mergeClientsIndexSearch(prev, {
            search: trimmed || undefined,
            page: undefined,
          }),
        replace: true,
      });
      isUserTypingRef.current = false;
      return;
    }

    if (trimmed) {
      void navigate({
        to: "/clients",
        search: (prev) =>
          mergeClientsIndexSearch(prev, {
            search: trimmed,
            page: undefined,
          }),
      });
    }
    isUserTypingRef.current = false;
  }, [debouncedSearch, isOnClientDetail, isOnClientsIndex, navigate, urlSearchTerm]);

  const handleSearchChange = (value: string) => {
    isUserTypingRef.current = true;
    setInputValue(value);
  };

  return (
    <header className="h-16 border-b border-border bg-surface/60 backdrop-blur flex items-center px-4 md:px-6 gap-4">
      <img
        src={BRAND_LOGO_SOLO}
        alt={`${BRAND_NAME} isotipo`}
        className="h-8 w-8 object-contain shrink-0 md:hidden"
      />

      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search clients, deals…"
          className="pl-9 bg-surface-elevated border-border h-9"
          aria-label="Búsqueda global de clientes"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-md bg-surface-elevated border border-border text-sm">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-medium">{roleLabel}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 pl-3 border-l border-border outline-none">
            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
              {currentUser.initials}
            </div>
            <div className="leading-tight hidden sm:block text-left">
              <div className="text-sm font-medium">{currentUser.name}</div>
              <div className="text-[10px] text-muted-foreground">{roleLabel}</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="truncate">{currentUser.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
