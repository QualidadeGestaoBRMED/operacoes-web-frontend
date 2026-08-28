"use client";

import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LABEL_AREA_RESPONSAVEL } from "@/lib/kanban";
import type { AreaResponsavel } from "@/types";

const AREAS_RESPONSAVEL: AreaResponsavel[] = [
  "gerencia",
  "processo",
  "qualidade",
  "desenvolvimento",
];

// STC-391: mesmo padrão de multi-seleção em Popover+Checkbox de
// SeletorEtiquetas.tsx, mas simplificado -- AreaResponsavel é um enum fixo
// de 4 valores hardcoded no frontend (sem catálogo via API), então sem
// busca, sem hook SWR e sem "criar novo item".
export function SeletorAreaResponsavel({
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
}: {
  value: AreaResponsavel[];
  onChange: (areas: AreaResponsavel[]) => void;
  // id: pra Label htmlFor apontar pro gatilho (uso em FormNovaDemanda).
  // aria-label: nome acessível fixo, independente do texto do botão --
  // sem isso, o texto interno ("Selecionar área responsável" ->
  // "Adicionar área" depois da 1a seleção) vira o nome acessível e perde a
  // palavra "responsável" justamente no estado mais comum (uso em
  // KanbanFiltros, achado no code review). Passar os dois é redundante;
  // cada consumidor usa o que fizer sentido pro próprio layout.
  id?: string;
  "aria-label"?: string;
}) {
  function alternar(area: AreaResponsavel) {
    onChange(
      value.includes(area) ? value.filter((existente) => existente !== area) : [...value, area],
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((area) => (
        <span
          key={area}
          className="flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
        >
          {LABEL_AREA_RESPONSAVEL[area]}
          <button
            type="button"
            onClick={() => alternar(area)}
            aria-label={`Remover área responsável ${LABEL_AREA_RESPONSAVEL[area]}`}
            className="opacity-80 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            aria-label={ariaLabel}
            className="flex items-center gap-0.5 rounded border border-dashed border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:border-secondary hover:text-secondary"
          >
            {value.length === 0 ? "Selecionar área responsável" : "Adicionar área"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1.5">
          {AREAS_RESPONSAVEL.map((area) => (
            <label
              key={area}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={value.includes(area)}
                onCheckedChange={() => alternar(area)}
                className="shrink-0"
              />
              <span className="truncate">{LABEL_AREA_RESPONSAVEL[area]}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
