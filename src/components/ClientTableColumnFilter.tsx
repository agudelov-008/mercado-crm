import { MultiSelectFilterSelect } from "@/components/MultiSelectFilterSelect";
import { Input } from "@/components/ui/input";
import { CountryDisplay } from "@/lib/country-flags";
import {
  LEAD_STATUS_OPTIONS,
  type ClientTableColumnDef,
  type SecureClientColumn,
  type SecureClientFilters,
} from "@/lib/secure-clients";

type ClientTableColumnFilterProps = {
  col: ClientTableColumnDef;
  filters: SecureClientFilters;
  onChange: (next: SecureClientFilters) => void;
  countryOptions: string[];
  affiliateOptions: string[];
  ownerOptions: string[];
};

export function ClientTableColumnFilter({
  col,
  filters,
  onChange,
  countryOptions,
  affiliateOptions,
  ownerOptions,
}: ClientTableColumnFilterProps) {
  if (col.filterType === "searchable-select") {
    const key = col.key as "affiliate" | "owner_name" | "previous_owner_name";
    const options = key === "affiliate" ? affiliateOptions : ownerOptions;

    return (
      <MultiSelectFilterSelect
        value={filters[key]}
        onChange={(values) => onChange({ ...filters, [key]: values })}
        options={options}
        placeholder="Todos"
      />
    );
  }

  if (col.filterType === "country") {
    return (
      <MultiSelectFilterSelect
        value={filters.country}
        onChange={(values) => onChange({ ...filters, country: values })}
        options={countryOptions}
        placeholder="Todos"
        renderOption={(country) => <CountryDisplay country={country} />}
        formatSelectionLabel={(values) =>
          values.length === 1 ? values[0] : undefined
        }
      />
    );
  }

  if (col.filterType === "text") {
    const key = col.key as Extract<
      SecureClientColumn,
      "first_name" | "last_name" | "tp_account" | "phone" | "email"
    >;
    return (
      <Input
        value={filters[key]}
        onChange={(e) => onChange({ ...filters, [key]: e.target.value })}
        placeholder="Filtrar…"
        className="h-7 min-w-0 text-xs p-1 bg-surface-elevated border-border text-foreground w-full rounded"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (col.filterType === "number") {
    const key = col.key as "total_calls";
    return (
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={filters[key]}
        onChange={(e) => onChange({ ...filters, [key]: e.target.value })}
        placeholder="0"
        className="h-7 min-w-0 text-xs p-1 bg-surface-elevated border-border text-foreground w-full rounded tabular-nums"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Filtrar ${col.label}`}
      />
    );
  }

  if (col.filterType === "select") {
    const key = col.key as "lead_status" | "previous_lead_status";
    return (
      <MultiSelectFilterSelect
        value={filters[key]}
        onChange={(values) => onChange({ ...filters, [key]: values })}
        options={LEAD_STATUS_OPTIONS}
        placeholder="Todos"
      />
    );
  }

  const dateKey = col.key as
    | "created_on"
    | "last_assignment"
    | "last_contacted";
  return (
    <Input
      type="date"
      value={filters[dateKey]}
      onChange={(e) => onChange({ ...filters, [dateKey]: e.target.value })}
      className="h-7 min-w-0 text-xs p-1 bg-surface-elevated border-border text-foreground w-full rounded"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Filtrar ${col.label} por día`}
    />
  );
}
