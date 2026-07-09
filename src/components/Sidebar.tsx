import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Shield,
  Building2,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { BRAND_LOGO_SOLO, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import {
  canAccessAffiliatesModule,
  canAccessDashboardNav,
  canAccessTasksNav,
  canAccessUserManagement,
} from "@/lib/role-rbac";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

type SidebarMenuContextValue = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  desktopExpanded: boolean;
  setDesktopExpanded: (expanded: boolean) => void;
  toggleSidebar: () => void;
  isSidebarVisible: boolean;
};

const SIDEBAR_EXPANDED_KEY = "sidebar_expanded";

const SidebarMenuContext = createContext<SidebarMenuContextValue | null>(null);

function readDesktopExpanded(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

function useSidebarMenu(): SidebarMenuContextValue {
  const context = useContext(SidebarMenuContext);
  if (!context) {
    throw new Error("useSidebarMenu must be used within SidebarMenuProvider.");
  }
  return context;
}

export function SidebarMenuProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(readDesktopExpanded);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(desktopExpanded));
    } catch {
      // Ignore storage errors (private browsing, quota, etc.).
    }
  }, [desktopExpanded]);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileOpen((open) => !open);
      return;
    }
    setDesktopExpanded((expanded) => !expanded);
  }, [isMobile]);

  const isSidebarVisible = isMobile ? mobileOpen : desktopExpanded;

  const value = useMemo(
    () => ({
      mobileOpen,
      setMobileOpen,
      desktopExpanded,
      setDesktopExpanded,
      toggleSidebar,
      isSidebarVisible,
    }),
    [mobileOpen, desktopExpanded, toggleSidebar, isSidebarVisible],
  );

  return (
    <SidebarMenuContext.Provider value={value}>{children}</SidebarMenuContext.Provider>
  );
}

export function SidebarMenuTrigger() {
  const { toggleSidebar, isSidebarVisible } = useSidebarMenu();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0"
      onClick={toggleSidebar}
      aria-label={isSidebarVisible ? "Colapsar menú de navegación" : "Abrir menú de navegación"}
      aria-expanded={isSidebarVisible}
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

export function useSidebarMenuState() {
  return useSidebarMenu();
}

function useNavItems(): NavItem[] {
  const { profileRole } = useApp();

  return useMemo(() => {
    const items: NavItem[] = [];

    if (canAccessDashboardNav(profileRole)) {
      items.push({ to: "/", label: "Dashboard", icon: LayoutDashboard });
    }

    items.push({ to: "/clients", label: "My Clients", icon: Users });

    if (canAccessTasksNav(profileRole)) {
      items.push({ to: "/calendar", label: "Calendario", icon: CalendarDays });
    }

    if (canAccessUserManagement(profileRole)) {
      items.push({ to: "/users", label: "User Management", icon: Shield });
    }

    if (canAccessAffiliatesModule(profileRole)) {
      items.push({ to: "/affiliates", label: "Afiliadoras", icon: Building2 });
    }

    return items;
  }, [profileRole]);
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border shrink-0">
      <img
        src={BRAND_LOGO_SOLO}
        alt={`${BRAND_NAME} isotipo`}
        className="h-9 w-9 object-contain shrink-0"
      />
      <div className="leading-tight min-w-0">
        <div className="text-sm font-semibold tracking-tight truncate">{BRAND_NAME}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {BRAND_TAGLINE}
        </div>
      </div>
    </div>
  );
}

function SidebarNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const nav = useNavItems();

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {nav.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all whitespace-nowrap ${
              active
                ? "bg-primary/15 text-foreground border border-primary/30 shadow-glow"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { mobileOpen, setMobileOpen, desktopExpanded } = useSidebarMenu();
  const closeMobileMenu = useCallback(() => setMobileOpen(false), [setMobileOpen]);

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-border bg-surface/40 overflow-hidden transition-[width,border-color] duration-300 ease-in-out",
          desktopExpanded ? "w-60 border-r-border" : "w-0 border-r-transparent",
        )}
        aria-hidden={!desktopExpanded}
      >
        <div className="flex h-full w-60 flex-col">
          <SidebarBrand />
          <SidebarNavContent />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 gap-0 bg-surface/95">
          <SheetHeader className="sr-only">
            <SheetTitle>Menú de navegación</SheetTitle>
            <SheetDescription>Acceso a las secciones del CRM.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <SidebarBrand />
            <SidebarNavContent onNavigate={closeMobileMenu} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
