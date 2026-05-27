import type { QueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import type { NavigateOptions } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return Boolean(session?.user);
}

export async function handleLogout(
  queryClient: QueryClient,
  navigate: (options: NavigateOptions) => void,
) {
  await supabase.auth.signOut();
  queryClient.clear();
  navigate({ to: "/login" });
}