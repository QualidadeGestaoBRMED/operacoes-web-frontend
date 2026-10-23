"use client";

import { ChevronDownIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Unidade } from "@/types";

// Unidades além da principal (STC-862), com o mesmo acesso: quem coordena
// mais de uma unidade (ex.: Niterói com dois CNPJs). Multi-seleção por
// Popover+Checkbox, como SeletorAreaResponsavel; cada marcação grava na hora,
// como os outros campos da linha.
export function SeletorUnidadesAdicionais({
  value,
  opcoes,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: number[];
  /** Unidades que podem ser adicionais (sem a principal). */
  opcoes: Pick<Unidade, "id" | "nome">[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  function alternar(id: number) {
    onChange(value.includes(id) ? value.filter((existente) => existente !== id) : [...value, id]);
  }

  const nomes = opcoes.filter((unidade) => value.includes(unidade.id)).map((u) => u.nome);
  const rotulo =
    value.length === 0
      ? null
      : value.length > 1
        ? `+${value.length} unidades`
        : `+ ${nomes[0] ?? "1 unidade"}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          title={nomes.length > 0 ? nomes.join(", ") : undefined}
          disabled={disabled}
          className={cn(
            "mt-1 flex h-7 w-full max-w-64 items-center justify-between gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <span className="truncate text-left">{rotulo ?? "Unidades adicionais"}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        <p className="px-2 py-1 text-xs text-muted-foreground">
          Mesmo acesso da unidade principal.
        </p>
        <div className="scrollbar-discreta max-h-48 overflow-y-auto">
          {opcoes.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma outra unidade.</p>
          ) : (
            opcoes.map((unidade) => (
              <label
                key={unidade.id}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={value.includes(unidade.id)}
                  onCheckedChange={() => alternar(unidade.id)}
                  className="shrink-0"
                />
                <span className="truncate">{unidade.nome}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
