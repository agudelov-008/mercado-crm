import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type MultiSelectFilterSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  options: readonly string[];
  placeholder?: string;
  className?: string;
};

function formatSelectionLabel(value: string[], placeholder: string): string {
  if (value.length === 0) return placeholder;
  if (value.length === 1) return value[0];
  if (value.length === 2) return `${value[0]}, ${value[1]}`;
  return `${value.length} seleccionados`;
}

export function MultiSelectFilterSelect({
  value,
  onChange,
  options,
  placeholder = "Todos",
  className,
}: MultiSelectFilterSelectProps) {
  const [open, setOpen] = useState(false);

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
      return;
    }
    onChange([...value, option]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-7 min-w-0 text-xs px-2 bg-slate-900 border-slate-800 text-slate-300 w-full rounded justify-between font-normal",
            value.length === 0 && "text-muted-foreground",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate">
            {formatSelectionLabel(value, placeholder)}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput placeholder="Buscar…" className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onChange([]);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-3 w-3",
                    value.length === 0 ? "opacity-100" : "opacity-0",
                  )}
                />
                Todos
              </CommandItem>
              {options.map((option) => {
                const isSelected = value.includes(option);
                return (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => toggleOption(option)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{option}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
