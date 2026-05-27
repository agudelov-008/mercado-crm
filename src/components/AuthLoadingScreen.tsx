import { Loader2 } from "lucide-react";

export function AuthLoadingScreen() {
  return (
    <div className="dark min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Cargando sesión…</p>
      </div>
    </div>
  );
}
