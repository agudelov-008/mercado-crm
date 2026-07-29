import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { BRAND_LOGO_FULL_DARK, BRAND_NAME } from "@/lib/brand";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const normalized = error.message.toLowerCase();
      const friendlyMessage = normalized.includes("invalid login credentials")
        ? "Credenciales incorrectas. Revisa tu email y password."
        : normalized.includes("email not confirmed")
          ? "Tu email aun no ha sido confirmado."
          : "No fue posible iniciar sesion. Intenta de nuevo.";
      toast.error(friendlyMessage);
      setIsSubmitting(false);
      return;
    }

    toast.success("Sesion iniciada correctamente.");
    navigate({ to: "/" });
    setIsSubmitting(false);
  };

  return (
    <div className="h-screen w-full flex overflow-hidden">
      {/* Lado Izquierdo (Branding) */}
      <aside
        className={cn(
          "hidden lg:flex w-1/2 flex-col relative",
          isDark
            ? "bg-gradient-to-br from-[#030508] via-[#050810] to-[#000000]"
            : "bg-gradient-to-br from-[#0f1a2e] via-[#152238] to-[#0a1220]",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 pointer-events-none",
            isDark
              ? "bg-[radial-gradient(ellipse_at_center,_#0c1220_0%,_transparent_65%)] opacity-30"
              : "bg-[radial-gradient(ellipse_at_center,_#1e3354_0%,_transparent_70%)] opacity-50",
          )}
        />

        {/* Contenedor central con el logo, título y texto */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 relative z-10">
          <img
            src={BRAND_LOGO_FULL_DARK}
            alt={`${BRAND_NAME} logo`}
            className="w-[300px] md:w-[400px] lg:w-[500px] xl:w-[550px] h-auto object-contain drop-shadow-2xl"
          />

          <p
            className={cn(
              "mt-2 text-sm max-w-sm leading-relaxed",
              isDark ? "text-[#8b95a8]" : "text-[#9ca3af]",
            )}
          >
            Institutional grade client intelligence, portfolio oversight, and compliance workflows for wealth advisors.
          </p>
        </div>
      </aside>

      {/* Lado Derecho (Formulario) */}
      <main
        className={cn(
          "w-full lg:w-1/2 flex flex-col relative",
          isDark ? "bg-[#000000]" : "bg-[#0b111b]",
        )}
      >
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        {/* Logo en versión móvil (visible solo en pantallas pequeñas) */}
        <div
          className={cn(
            "lg:hidden p-6 border-b flex justify-center",
            isDark ? "border-[#1a1a1a] bg-[#000000]" : "border-[#1a2332] bg-[#0b111b]",
          )}
        >
          <img
            src={BRAND_LOGO_FULL_DARK}
            alt={`${BRAND_NAME} logo`}
            className="h-12 w-auto"
          />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm space-y-8 animate-fade-in-up">
            <div>
              <h2 className="text-2xl font-semibold text-white font-sans tracking-tight">Sign In</h2>
              <p className={cn("mt-1.5 text-sm", isDark ? "text-[#8b95a8]" : "text-[#9ca3af]")}>
                Access your advisor workspace
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className={isDark ? "text-[#a8b2c1]" : "text-[#9ca3af]"}>
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7280] pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="you@quantcapital.com"
                    required
                    autoComplete="email"
                    className={cn(
                      "pl-9 text-white placeholder:text-[#6b7280]",
                      isDark
                        ? "bg-[#0a0a0a] border-[#1f1f1f] focus-visible:ring-[#2a2a2a]"
                        : "bg-[#111827] border-[#1e293b] focus-visible:ring-[#334155]",
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className={isDark ? "text-[#a8b2c1]" : "text-[#9ca3af]"}>
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b7280] pointer-events-none" />
                  <Input
                    id="password"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className={cn(
                      "pl-9 text-white placeholder:text-[#6b7280]",
                      isDark
                        ? "bg-[#0a0a0a] border-[#1f1f1f] focus-visible:ring-[#2a2a2a]"
                        : "bg-[#111827] border-[#1e293b] focus-visible:ring-[#334155]",
                    )}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#00c853] text-white hover:bg-[#00b34a] shadow-none"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}