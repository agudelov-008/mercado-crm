import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Opciones compartidas para queries de citas — staleTime evita refetch en cada focus. */
export const appointmentsQueryOptions = {
  staleTime: 60_000,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
} as const;

export function useAppointmentsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("realtime-appointments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["appointments"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
