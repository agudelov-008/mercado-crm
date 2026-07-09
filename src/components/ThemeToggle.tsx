import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/lib/theme-context";

export function ThemeToggle() {
  const { isDark, setTheme } = useTheme();

  return (
    <div
      className="flex items-center gap-1.5"
      title={isDark ? "Modo oscuro activo" : "Modo claro activo"}
    >
      <Sun
        className="h-4 w-4 text-muted-foreground"
        aria-hidden
      />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Cambiar entre tema claro y oscuro"
      />
      <Moon
        className="h-4 w-4 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
