import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown } from "lucide-react";
import {
  clientsIndexSearchFromReturnContext,
  type ClientsListReturnContext,
} from "@/lib/clients-route-search";
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PageOption {
  key: "prev" | "current" | "next";
  label: string;
  page: number;
  disabled: boolean;
}

function buildPageOptions(context: ClientsListReturnContext | null): PageOption[] {
  const currentPage = context?.page ?? 1;
  const totalPages = context?.totalPages ?? 1;
  const prevPage = currentPage - 1;
  const nextPage = currentPage + 1;

  return [
    {
      key: "prev",
      label: "Página anterior",
      page: prevPage,
      disabled: prevPage < 1,
    },
    {
      key: "current",
      label: "Página actual",
      page: currentPage,
      disabled: false,
    },
    {
      key: "next",
      label: "Página siguiente",
      page: nextPage,
      disabled: nextPage > totalPages,
    },
  ];
}

interface ClientsBackMenuProps {
  listContext: ClientsListReturnContext | null;
  className?: string;
}

export function ClientsBackMenu({ listContext, className }: ClientsBackMenuProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pageOptions = buildPageOptions(listContext);

  const navigateToPage = (page: number) => {
    setOpen(false);
    void navigate({
      to: "/clients",
      search: listContext
        ? clientsIndexSearchFromReturnContext(listContext, page)
        : {},
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 w-fit",
            className,
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a clientes
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-black/40 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%]",
            "rounded-xl border border-border bg-background p-4 shadow-elegant",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Title className="text-sm font-semibold mb-1">
            Volver a clientes
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-xs text-muted-foreground mb-4">
            Elige a qué página regresar. Se conservarán los filtros que tenías
            aplicados.
          </DialogPrimitive.Description>
          <div className="flex flex-col gap-2">
            {pageOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                disabled={option.disabled}
                onClick={() => navigateToPage(option.page)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  option.disabled
                    ? "cursor-not-allowed border-border/60 bg-muted/20 text-muted-foreground/60"
                    : "border-border bg-surface-elevated hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <span>{option.label}</span>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {option.disabled &&
                  (option.page < 1 || option.page > (listContext?.totalPages ?? 1))
                    ? "No disponible"
                    : `Página ${option.page}`}
                </span>
              </button>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
