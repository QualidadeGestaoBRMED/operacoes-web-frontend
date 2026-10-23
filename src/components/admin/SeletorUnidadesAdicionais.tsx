"use client";

import { Plus } from "lucide-react";
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          title={
            nomes.length > 0 ? `Unidades adicionais: ${nomes.join(", ")}` : "Unidades adicionais"
          }
          disabled={disabled}
          className={cn(
            // Mesma altura e borda dos Selects da linha, ao lado do de unidade.
            "flex h-9 shrink-0 items-center justify-center gap-1 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
            value.length === 0 ? "text-muted-foreground" : "font-medium text-foreground",
          )}
        >
          {value.length === 0 ? (
            <Plus aria-hidden className="size-4" />
          ) : (
            <span className="tabular-nums">+{value.length}</span>
          )}
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
