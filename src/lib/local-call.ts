import { supabase } from "@/lib/supabase";

/** Deja solo dígitos para el protocolo tel: (MicroSIP u otro handler del SO). */
export function sanitizePhoneForCall(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Registra la llamada en Supabase sin bloquear la UI. */
export function registerCrmCallAsync(cleanPhone: string): void {
  void supabase.rpc("register_crm_call", {
    client_phone_param: cleanPhone,
  });
}

/**
 * Registra la llamada en la BD y abre MicroSIP vía `tel:` al instante.
 * Usa el número real del cliente en memoria (puede estar enmascarado en pantalla).
 */
export function initiateLocalPhoneCall(phone: string | null | undefined): void {
  const clean = sanitizePhoneForCall((phone ?? "").trim());
  if (!clean) return;

  registerCrmCallAsync(clean);
  window.location.href = `tel:${clean}`;
}
