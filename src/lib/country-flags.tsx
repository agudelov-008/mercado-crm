import { cn } from "@/lib/utils";

/** Banderas para visualización en tablas, fichas y filtros por país. */

type CountryEntry = {
  keys: string[];
  iso2: string;
  label: string;
};

const COUNTRY_ENTRIES: CountryEntry[] = [
  { keys: ["colombia", "co", "col"], iso2: "co", label: "Colombia" },
  { keys: ["mexico", "mx", "mex"], iso2: "mx", label: "México" },
  { keys: ["peru", "pe"], iso2: "pe", label: "Perú" },
  { keys: ["chile", "cl"], iso2: "cl", label: "Chile" },
  { keys: ["ecuador", "ec"], iso2: "ec", label: "Ecuador" },
  { keys: ["honduras", "hn"], iso2: "hn", label: "Honduras" },
  { keys: ["guatemala", "gt"], iso2: "gt", label: "Guatemala" },
  { keys: ["elsalvador", "el salvador", "sv"], iso2: "sv", label: "El Salvador" },
  { keys: ["bolivia", "bo"], iso2: "bo", label: "Bolivia" },
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

function matchesCountryKey(cleaned: string, key: string): boolean {
  if (cleaned === key) return true;

  if (key.length <= 3) {
    return new RegExp(`(^|\\s)${key}(\\s|$)`).test(cleaned);
  }

  if (cleaned.includes(key)) return true;
  return new RegExp(`\\b${key.replace(/\s/g, "\\s+")}\\b`).test(cleaned);
}

function findEntry(cleaned: string): CountryEntry | null {
  for (const entry of COUNTRY_ENTRIES) {
    if (entry.keys.some((key) => matchesCountryKey(cleaned, key))) {
      return entry;
    }
  }
  return null;
}

/**
 * Limpia prefijos ISO y ruido (ej. "MX MEXICO", "USA co Colombia") y devuelve
 * el país si hay coincidencia con la lista soportada.
 */
export function resolveCountryDisplay(
  country: string | null | undefined,
): { iso2: string; label: string } | null {
  if (!country?.trim()) return null;

  const normalized = normalizeCountryText(country);
  const direct = findEntry(normalized);
  if (direct) {
    return { iso2: direct.iso2, label: direct.label };
  }

  let cleaned = normalized;

  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  cleaned = cleaned.replace(ISO_PREFIX_PATTERN, "").trim();

  while (ISO_PREFIX_PATTERN.test(cleaned)) {
    cleaned = cleaned.replace(ISO_PREFIX_PATTERN, "").trim();
  }

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  const stripped = findEntry(cleaned);
  if (stripped) {
    return { iso2: stripped.iso2, label: stripped.label };
  }

  for (const entry of COUNTRY_ENTRIES) {
    const matched = entry.keys.some(
      (key) => key.length > 3 && normalized.includes(key),
    );
    if (matched) {
      return { iso2: entry.iso2, label: entry.label };
    }
  }

  return null;
}

export function getCountryFilterKeys(label: string): string[] | null {
  const entry = COUNTRY_ENTRIES.find((item) => item.label === label);
  return entry ? [...entry.keys] : null;
}

/** Opciones fijas del filtro por país (independientes de los datos en BD). */
export function getSupportedCountryFilterOptions(): string[] {
  return COUNTRY_ENTRIES.map((entry) => entry.label).sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

export function getCountryFlagEmoji(country: string | null | undefined): string | null {
  const resolved = resolveCountryDisplay(country);
  if (!resolved) return null;
  const code = resolved.iso2.toUpperCase();
  return String.fromCodePoint(
    ...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

function CountryFlagImage({
  iso2,
  label,
  className,
}: {
  iso2: string;
  label: string;
  className?: string;
}) {
  return (
    <img
      src={`https://flagcdn.com/w40/${iso2}.png`}
      srcSet={`https://flagcdn.com/w80/${iso2}.png 2x`}
      width={20}
      height={15}
      alt={label}
      title={label}
      className={cn(
        "inline-block h-[15px] w-5 shrink-0 rounded-[2px] border border-border/30 object-cover shadow-sm",
        className,
      )}
      loading="lazy"
      decoding="async"
    />
  );
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
    <CountryFlagImage
      iso2={resolved.iso2}
      label={resolved.label}
      className={className}
    />
  );
}
