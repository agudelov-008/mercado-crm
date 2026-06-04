import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { BRAND_LOGO_FULL, BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
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
      <aside className="hidden lg:flex w-1/2 flex-col bg-gradient-to-br from-[oklch(0.08_0.01_265)] via-[oklch(0.11_0.008_265)] to-[oklch(0.14_0.012_88)] relative">

        {/* Contenedor central con el logo, título y texto */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-12 relative z-10">

          {/* Logo masivo usando valores exactos en píxeles para forzar el tamaño */}
          <img
            src={BRAND_LOGO_FULL}
            alt={`${BRAND_NAME} logo`}
            className="w-[300px] md:w-[400px] lg:w-[500px] xl:w-[550px] h-auto object-contain drop-shadow-2xl"
          />

          <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">
            Premium client intelligence and advisor workflows — {BRAND_NAME}.
          </p>

        </div>

        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 bg-gradient-primary opacity-20 pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      </aside>

      {/* Lado Derecho (Formulario) */}
      <main className="w-full lg:w-1/2 flex flex-col bg-background">
        {/* Logo en versión móvil (visible solo en pantallas pequeñas) */}
        <div className="lg:hidden p-6 border-b border-border flex justify-center">
          <img
            src={BRAND_LOGO_FULL}
            alt={`${BRAND_NAME} logo`}
            className="h-12 w-auto"
          />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm space-y-8 animate-fade-in-up">
            <div>
              <h2 className="text-2xl font-semibold text-white font-sans tracking-tight">Sign In</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Access your advisor workspace
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="you@fiveelements.com"
                    required
                    autoComplete="email"
                    className="pl-9 bg-slate-800/50 border-slate-700 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="pl-9 bg-slate-800/50 border-slate-700 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-success text-success-foreground hover:bg-success/90 shadow-glow"
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