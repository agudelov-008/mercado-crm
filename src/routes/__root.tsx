import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { BRAND_LOGO_SOLO, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { AppProvider } from "@/lib/app-context";
import { AuthGate, AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("crm_theme");document.documentElement.classList.toggle("dark",t!=="light");}catch(e){document.documentElement.classList.add("dark");}})();`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${BRAND_NAME} — ${BRAND_TAGLINE}` },
      { name: "description", content: `Premium CRM for wealth advisors — ${BRAND_NAME}.` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: BRAND_LOGO_SOLO },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ThemedToaster() {
  const { isDark } = useTheme();
  return <Toaster theme={isDark ? "dark" : "light"} />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isLoginRoute = useRouterState({
    select: (state) => state.location.pathname === "/login",
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider queryClient={queryClient}>
          <AuthGate>
            <AppProvider>
              {isLoginRoute ? (
                <Outlet />
              ) : (
                <AppShell>
                  <Outlet />
                </AppShell>
              )}
              <ThemedToaster />
            </AppProvider>
          </AuthGate>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
