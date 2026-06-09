import { useApp } from "@/lib/app-context";
import {
  canViewClientContactInUi,
  shouldMaskContactInUi,
} from "@/lib/role-rbac";

/** Indica si el usuario actual debe ver teléfono/correo enmascarados en pantalla. */
export function useContactUiMasking(): boolean {
  const { profileRole } = useApp();
  return shouldMaskContactInUi(profileRole);
}

/** Indica si el usuario actual puede ver teléfono y correo del cliente. */
export function useCanViewClientContact(): boolean {
  const { profileRole } = useApp();
  return canViewClientContactInUi(profileRole);
}

/** Enmascara teléfono para UI (ej. +57 ********33). */
export function maskPhone(phone: string | null | undefined): string {
  const trimmed = (phone ?? "").trim();
  if (!trimmed) return "—";

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length <= 2) {
    return "*".repeat(Math.max(trimmed.length, 4));
  }

  const visibleTail = digits.slice(-2);
  const hasPlus = trimmed.startsWith("+");

  if (hasPlus) {
    const countryLen = Math.min(3, Math.max(1, digits.length - 10));
    const prefix = `+${digits.slice(0, countryLen)}`;
    return `${prefix} ${"*".repeat(8)}${visibleTail}`;
  }

  const prefix = digits.length > 6 ? digits.slice(0, 2) : "";
  const masked = "*".repeat(8);
  return prefix ? `${prefix}${masked}${visibleTail}` : `${masked}${visibleTail}`;
}

/** Enmascara correo para UI (ej. ca*****@example.com). */
export function maskEmail(email: string | null | undefined): string {
  const trimmed = (email ?? "").trim();
  if (!trimmed) return "—";

  const at = trimmed.indexOf("@");
  if (at <= 0) return "*****";

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "*****";

  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}*****@${domain}`;
}
