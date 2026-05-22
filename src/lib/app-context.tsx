import { createContext, useContext, useState, type ReactNode } from "react";

export type Role = "Administrator" | "Agent";

interface AppContextValue {
  role: Role;
  setRole: (r: Role) => void;
  currentUser: { name: string; initials: string };
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("Administrator");
  const currentUser = role === "Administrator"
    ? { name: "Lucía Herrera", initials: "LH" }
    : { name: "Carlos Mendoza", initials: "CM" };
  return (
    <AppContext.Provider value={{ role, setRole, currentUser }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
