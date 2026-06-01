import type { ProfileRole } from "@/lib/app-context";
import { supabase } from "@/lib/supabase";

export interface TeamProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: ProfileRole;
  created_at: string | null;
}

export interface AgentFormInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface AgentUpdateInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface PortfolioClient {
  phone: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  lead_status: string | null;
}

const PORTFOLIO_CLIENT_COLUMNS =
  "phone, first_name, last_name, email, lead_status, owner_id";

export interface ProfileAgentOption {
  id: string;
  label: string;
}

function profileDisplayName(row: {
  first_name: string | null;
  last_name: string | null;
  email: string;
}): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || row.email;
}

export async function fetchAgentProfiles(): Promise<TeamProfile[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, role, created_at")
      .eq("role", "Agent")
      .order("first_name", { ascending: true });

    if (error) throw error;
    return (data ?? []) as TeamProfile[];
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudieron cargar los asesores.";
    throw new Error(message);
  }
}

/** Perfiles con rol Agent (asignación de owner en detalle de cliente). */
export async function fetchAgentsForOwnerSelect(): Promise<ProfileAgentOption[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("role", "Agent")
      .order("first_name", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const profile = row as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string;
      };
      return {
        id: profile.id,
        label: profileDisplayName(profile),
      };
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudieron cargar los asesores.";
    throw new Error(message);
  }
}

export async function createAgentWithUser(data: AgentFormInput): Promise<void> {
  try {
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const email = data.email.trim();
    const password = data.password;

    if (!firstName) throw new Error("El nombre es obligatorio.");
    if (!email) throw new Error("El correo electrónico es obligatorio.");
    if (!password) throw new Error("La contraseña temporal es obligatoria.");

    const { error: rpcError } = await supabase.rpc("create_agent_with_user", {
      user_email: email,
      user_password: password,
      user_first_name: firstName,
      user_last_name: lastName || null,
    });

    if (!rpcError) return;

    const { error: fnError } = await supabase.functions.invoke("create-agent", {
      body: {
        email,
        password,
        firstName,
        lastName: lastName || null,
      },
    });

    if (fnError) {
      throw rpcError.code === "PGRST202"
        ? fnError
        : rpcError;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo crear el asesor y su cuenta de acceso.";
    throw new Error(message);
  }
}

export function portfolioClientLabel(client: PortfolioClient): string {
  const name = [client.first_name, client.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name ? `${name} · ${client.phone}` : client.phone;
}

export async function fetchClientsByOwnerId(
  ownerId: string,
): Promise<PortfolioClient[]> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select(PORTFOLIO_CLIENT_COLUMNS)
      .eq("owner_id", ownerId)
      .order("first_name", { ascending: true });

    if (error) throw error;
    return (data ?? []) as PortfolioClient[];
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudieron cargar los clientes asignados.";
    throw new Error(message);
  }
}

export async function fetchUnassignedClients(): Promise<PortfolioClient[]> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select(PORTFOLIO_CLIENT_COLUMNS)
      .is("owner_id", null)
      .order("phone", { ascending: true });

    if (error) throw error;
    return (data ?? []) as PortfolioClient[];
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "No se pudieron cargar los clientes sin asignar.";
    throw new Error(message);
  }
}

export async function updateAgentProfile(
  agentId: string,
  data: AgentUpdateInput,
): Promise<void> {
  try {
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const email = data.email.trim();
    const password = data.password.trim();

    if (!firstName) throw new Error("El nombre es obligatorio.");
    if (!email) throw new Error("El correo electrónico es obligatorio.");

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName || null,
        email,
      })
      .eq("id", agentId)
      .eq("role", "Agent");

    if (profileError) throw profileError;

    if (password.length > 0) {
      const { error: rpcError } = await supabase.rpc("update_agent_with_user", {
        agent_id: agentId,
        user_email: email,
        user_first_name: firstName,
        user_last_name: lastName || null,
        user_password: password,
      });

      if (rpcError && rpcError.code !== "PGRST202") {
        throw rpcError;
      }
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo actualizar el asesor.";
    throw new Error(message);
  }
}

export async function deleteAgentProfile(agentId: string): Promise<void> {
  try {
    const { error: rpcError } = await supabase.rpc("delete_agent_with_user", {
      agent_id: agentId,
    });

    if (!rpcError) return;

    if (rpcError.code !== "PGRST202") {
      throw rpcError;
    }

    const { data: ownedClients, error: clientsError } = await supabase
      .from("clients")
      .select("phone")
      .eq("owner_id", agentId);

    if (clientsError) throw clientsError;

    const phones = (ownedClients ?? []).map(
      (row) => (row as { phone: string }).phone,
    );

    if (phones.length > 0) {
      const { error: unassignError } = await supabase
        .from("clients")
        .update({ owner_id: null })
        .in("phone", phones);

      if (unassignError) throw unassignError;
    }

    const { error: deleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", agentId)
      .eq("role", "Agent");

    if (deleteError) throw deleteError;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo eliminar el asesor.";
    throw new Error(message);
  }
}

export async function countClientsByOwnerIds(
  ownerIds: string[],
): Promise<Map<string, number>> {
  if (ownerIds.length === 0) return new Map();

  try {
    const { data, error } = await supabase
      .from("clients")
      .select("owner_id")
      .in("owner_id", ownerIds);

    if (error) throw error;

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const ownerId = (row as { owner_id: string | null }).owner_id;
      if (!ownerId) continue;
      counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
    }
    return counts;
  } catch {
    return new Map();
  }
}
