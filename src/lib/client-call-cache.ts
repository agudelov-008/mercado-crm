import type { QueryClient } from "@tanstack/react-query";
import { sanitizePhoneForCall } from "@/lib/local-call";
import type {
  SecureClientDetail,
  SecureClientsPageResult,
} from "@/lib/secure-clients";

function phonesMatch(a: string, b: string): boolean {
  return sanitizePhoneForCall(a) === sanitizePhoneForCall(b);
}

/** Actualiza last_contacted y total_calls en caché tras registrar una llamada. */
export function patchClientAfterCallInCache(
  queryClient: QueryClient,
  phone: string,
  contactedAt: string,
): void {
  queryClient.setQueriesData<SecureClientsPageResult>(
    { queryKey: ["secure-clients"] },
    (old) => {
      if (!old?.rows) return old;
      let changed = false;
      const rows = old.rows.map((row) => {
        if (!phonesMatch(row.phone, phone)) return row;
        changed = true;
        return {
          ...row,
          last_contacted: contactedAt,
          total_calls: (row.total_calls ?? 0) + 1,
        };
      });
      return changed ? { ...old, rows } : old;
    },
  );

  queryClient.setQueriesData<SecureClientDetail>(
    {
      predicate: (query) =>
        query.queryKey[0] === "secure-client" &&
        typeof query.queryKey[1] === "string" &&
        phonesMatch(query.queryKey[1], phone),
    },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        last_contacted: contactedAt,
        total_calls: (old.total_calls ?? 0) + 1,
      };
    },
  );
}

export function invalidateQueriesAfterClientCall(
  queryClient: QueryClient,
  phone?: string,
): void {
  void queryClient.invalidateQueries({ queryKey: ["secure-clients"] });
  void queryClient.invalidateQueries({ queryKey: ["secure-client"] });
  if (phone) {
    void queryClient.invalidateQueries({ queryKey: ["activity-logs", phone] });
  } else {
    void queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
  }
  void queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard-priority-clients"] });
}
