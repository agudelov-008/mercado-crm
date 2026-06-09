import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  invalidateQueriesAfterClientCall,
  patchClientAfterCallInCache,
} from "@/lib/client-call-cache";
import { initiateLocalPhoneCall } from "@/lib/local-call";

/** Registra la llamada, actualiza la UI y abre el marcador local (MicroSIP). */
export function useClientCall() {
  const queryClient = useQueryClient();

  const callClient = useCallback(
    async (phone: string | null | undefined) => {
      const trimmed = (phone ?? "").trim();
      if (!trimmed) return;

      const contactedAt = new Date().toISOString();
      const registered = await initiateLocalPhoneCall(trimmed);

      if (registered) {
        patchClientAfterCallInCache(queryClient, trimmed, contactedAt);
        invalidateQueriesAfterClientCall(queryClient, trimmed);
      }
    },
    [queryClient],
  );

  return { callClient };
}
