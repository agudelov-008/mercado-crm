import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { openWhatsAppChat } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

interface WhatsAppActionButtonProps {
  phone: string | null | undefined;
  /** `compact`: icono en tabla; `full`: barra de acciones con etiqueta. */
  variant?: "compact" | "full";
  className?: string;
  onBeforeOpen?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function WhatsAppActionButton({
  phone,
  variant = "full",
  className,
  onBeforeOpen,
}: WhatsAppActionButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    onBeforeOpen?.(e);
    openWhatsAppChat(phone);
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "h-8 w-8 rounded-md bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/35 flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none",
          className,
        )}
        aria-label="Abrir WhatsApp"
      >
        <WhatsAppIcon className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "h-10 px-4 rounded-md bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/35 transition-all flex items-center gap-2 text-sm font-medium hover:shadow-[0_0_20px_rgba(37,211,102,0.28)] disabled:opacity-40 disabled:pointer-events-none",
        className,
      )}
    >
      <WhatsAppIcon className="h-4 w-4" />
      WhatsApp
    </button>
  );
}
