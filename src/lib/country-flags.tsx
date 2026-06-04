/** Banderas solo para visualización en tablas y fichas; filtros usan texto plano. */

const COUNTRY_ENTRIES: Array<{
  keys: string[];
  emoji: string;
  label: string;
}> = [
  { keys: ["colombia"], emoji: "🇨🇴", label: "Colombia" },
  { keys: ["mexico"], emoji: "🇲🇽", label: "México" },
  { keys: ["peru"], emoji: "🇵🇪", label: "Perú" },
  { keys: ["chile"], emoji: "🇨🇱", label: "Chile" },
  { keys: ["ecuador"], emoji: "🇪🇨", label: "Ecuador" },
  { keys: ["honduras"], emoji: "🇭🇳", label: "Honduras" },
  { keys: ["guatemala"], emoji: "🇬🇹", label: "Guatemala" },
  { keys: ["elsalvador", "el salvador"], emoji: "🇸🇻", label: "El Salvador" },
  { keys: ["bolivia"], emoji: "🇧🇴", label: "Bolivia" },
];

const ISO_PREFIX_PATTERN =
  /^(usa|us|mx|co|pe|cl|ec|hn|gt|sv|bo|mex|col)[\s\-_/]+/i;

const NOISE_PATTERNS = [
  /\busa\s+co\b/gi,
  /\busa\s+/gi,
  /\bco\s+(?=[a-z])/gi,
];

function normalizeCountryText(country: string): string {
  return country
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Limpia prefijos ISO y ruido (ej. "MX MEXICO", "USA co Colombia") y devuelve
 * el nombre canónico del país si hay coincidencia.
 */
export function resolveCountryDisplay(
  country: string | null | undefined,
): { emoji: string; label: string } | null {
  if (!country?.trim()) return null;

  let cleaned = normalizeCountryText(country);

  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  cleaned = cleaned.replace(ISO_PREFIX_PATTERN, "").trim();

  while (ISO_PREFIX_PATTERN.test(cleaned)) {
    cleaned = cleaned.replace(ISO_PREFIX_PATTERN, "").trim();
  }

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  for (const entry of COUNTRY_ENTRIES) {
    const matched = entry.keys.some((key) => {
      if (cleaned === key) return true;
      if (cleaned.includes(key)) return true;
      return new RegExp(`\\b${key}\\b`).test(cleaned);
    });
    if (matched) {
      return { emoji: entry.emoji, label: entry.label };
    }
  }

  const original = normalizeCountryText(country);
  for (const entry of COUNTRY_ENTRIES) {
    if (entry.keys.some((key) => original.includes(key))) {
      return { emoji: entry.emoji, label: entry.label };
    }
  }

  return null;
}

export function getCountryFlagEmoji(country: string | null | undefined): string | null {
  return resolveCountryDisplay(country)?.emoji ?? null;
}

export function CountryDisplay({
  country,
  className,
}: {
  country: string | null | undefined;
  className?: string;
}) {
  if (!country?.trim()) {
    return <span className={className}>—</span>;
  }

  const resolved = resolveCountryDisplay(country);

  if (!resolved) {
    return <span className={className}>{country.trim()}</span>;
  }

  return (
    <span className={className ?? "inline-flex items-center gap-1.5"}>
      <span className="text-base leading-none" aria-hidden>
        {resolved.emoji}
      </span>
      <span>{resolved.label}</span>
    </span>
  );
}
