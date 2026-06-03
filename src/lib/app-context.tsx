import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

export type Role = "Administrator" | "Agent";
export type ProfileRole =
  | "Admin"
  | "Manager"
  | "Assistant"
  | "Agent"
  | "Affiliate";

const PROFILE_ROLES: readonly ProfileRole[] = [
  "Admin",
  "Manager",
  "Assistant",
  "Agent",
  "Affiliate",
] as const;

function parseProfileRole(value: unknown): ProfileRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim() as ProfileRole;
  return PROFILE_ROLES.includes(normalized) ? normalized : null;
}

interface ProfileData {
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: ProfileRole;
  affiliate_name: string | null;
}

interface AppContextValue {
  role: Role;
  setRole: (r: Role) => void;
  profileRole: ProfileRole | null;
  affiliateName: string | null;
  currentUser: {
    name: string;
    initials: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

const AppContext = createContext<AppContextValue | null>(null);

const defaultCurrentUser: AppContextValue["currentUser"] = {
  name: "User",
  initials: "U",
  email: "",
  firstName: "",
  lastName: "",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [profileRole, setProfileRole] = useState<ProfileRole | null>(null);
  const [affiliateName, setAffiliateName] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AppContextValue["currentUser"]>(defaultCurrentUser);

  useEffect(() => {
    if (isAuthLoading) return;

    let isMounted = true;

    const hydrateFromSession = async () => {
      if (!user) {
        if (!isMounted) return;
        setProfileRole(null);
        setAffiliateName(null);
        setCurrentUser(defaultCurrentUser);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("email, first_name, last_name, role, affiliate_name")
        .eq("id", user.id)
        .maybeSingle();

      const profile = (profileData as ProfileData | null) ?? null;
      const firstName = profile?.first_name?.trim() || "";
      const lastName = profile?.last_name?.trim() || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
        || user.email
        || "User";
      const initials = fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
        || "U";

      if (!isMounted) return;

      setProfileRole(parseProfileRole(profile?.role));
      setAffiliateName(profile?.affiliate_name?.trim() || null);
      setCurrentUser({
        name: fullName,
        initials,
        email: profile?.email ?? user.email ?? "",
        firstName,
        lastName,
      });
    };

    void hydrateFromSession();

    return () => {
      isMounted = false;
    };
  }, [user, isAuthLoading]);

  const role: Role = useMemo(() => {
    if (profileRole === "Agent") return "Agent";
    return "Administrator";
  }, [profileRole]);

  const setRole = () => {
    // El rol ahora viene exclusivamente de Supabase profiles.
  };

  return (
    <AppContext.Provider value={{ role, setRole, profileRole, affiliateName, currentUser }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { getProfileRoleLabel } from "@/lib/role-rbac";
