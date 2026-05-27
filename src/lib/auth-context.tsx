import type { QueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AuthLoadingScreen } from "@/components/AuthLoadingScreen";
import { handleLogout as signOutAndClear } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  handleLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (error) {
        console.error(error);
      }
      setSession(data.session);
      setIsLoading(false);
    };

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await signOutAndClear(queryClient, navigate);
    setSession(null);
  }, [navigate, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      handleLogout,
    }),
    [session, isLoading, handleLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const isLoginRoute = useRouterState({
    select: (state) => state.location.pathname === "/login",
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isLoginRoute) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (user && isLoginRoute) {
      navigate({ to: "/", replace: true });
    }
  }, [isLoading, user, isLoginRoute, navigate]);

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if ((!user && !isLoginRoute) || (user && isLoginRoute)) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
}
