import { cn } from "@/lib/utils";
import {
  maskEmail,
  maskPhone,
  useContactUiMasking,
} from "@/lib/contact-masking";

type ContactKind = "phone" | "email";

interface MaskedContactTextProps {
  kind: ContactKind;
  value: string | null | undefined;
  className?: string;
  mono?: boolean;
}

export function MaskedContactText({
  kind,
  value,
  className,
  mono,
}: MaskedContactTextProps) {
  const masked = useContactUiMasking();
  const raw = (value ?? "").trim();
  const display =
    !raw ? "—" : masked ? (kind === "phone" ? maskPhone(raw) : maskEmail(raw)) : raw;

  return (
    <span
      className={cn(
        masked && "select-none",
        mono && "tabular-nums font-mono",
        className,
      )}
      title={masked ? undefined : display === "—" ? undefined : display}
    >
      {display}
    </span>
  );
}
