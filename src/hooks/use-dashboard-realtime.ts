import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Opciones compartidas para queries del dashboard. */
export const dashboardQueryOptions = {
  refetchOnMount: true,
  refetchOnWindowFocus: true,
} as const;

function invalidateDashboardData(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard-priority-clients"] });
  void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
  void queryClient.invalidateQueries({ queryKey: ["secure-client"] });
}

/** Sincroniza KPIs del dashboard cuando cambian clientes o activity_logs (p. ej. tras Llamar). */
export function useDashboardRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("realtime-dashboard-calls")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clients" },
        () => invalidateDashboardData(queryClient),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        () => invalidateDashboardData(queryClient),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
