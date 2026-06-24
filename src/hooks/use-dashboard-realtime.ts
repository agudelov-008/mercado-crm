import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateQueriesAfterClientCall } from "@/lib/client-call-cache";
import { supabase } from "@/lib/supabase";

/** Opciones compartidas para queries del dashboard. */
export const dashboardQueryOptions = {
  staleTime: 60_000,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
} as const;

function invalidateDashboardData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard-priority-clients"] });
  void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
  void queryClient.invalidateQueries({ queryKey: ["secure-client"] });
  void queryClient.invalidateQueries({ queryKey: ["team-agents"] });
}

/** Sincroniza clientes y actividad cuando cambian en Supabase (p. ej. tras Llamar). */
export function useClientsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("realtime-clients-contact")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clients" },
        () => invalidateDashboardData(queryClient),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clients" },
        () => invalidateDashboardData(queryClient),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "clients" },
        () => invalidateDashboardData(queryClient),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        () => invalidateQueriesAfterClientCall(queryClient),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/** @deprecated Usa useClientsRealtime en AppShell; se mantiene por compatibilidad en el dashboard. */
export function useDashboardRealtime() {
  useClientsRealtime();
}
