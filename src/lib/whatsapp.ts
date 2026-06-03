import { toast } from "sonner";

/** Deja solo dígitos para la API oficial wa.me (sin mostrar en UI). */
export function sanitizePhoneForWhatsApp(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Abre el chat de WhatsApp del cliente sin exponer el número en el DOM.
 * El teléfono real solo viaja en la URL al hacer clic.
 */
export function openWhatsAppChat(phone: string | null | undefined): void {
  const clean = sanitizePhoneForWhatsApp((phone ?? "").trim());
  if (!clean) {
    toast.error("Este cliente no tiene un teléfono válido para WhatsApp.");
    return;
  }
  window.open(`https://wa.me/${clean}`, "_blank", "noopener,noreferrer");
}
