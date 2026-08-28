"use client";

import { ChevronDownIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LABEL_AREA_RESPONSAVEL } from "@/lib/kanban";
import { cn } from "@/lib/utils";
import type { AreaResponsavel } from "@/types";

const AREAS_RESPONSAVEL: AreaResponsavel[] = [
  "gerencia",
  "processo",
  "qualidade",
  "desenvolvimento",
];

// STC-392: gatilho com a mesma aparência de um Select comum (mesmas classes
// de SelectTrigger) -- achado no dogfooding: a primeira versão (chips
// removíveis + botão pontilhado "Adicionar área") destoava visualmente dos
// outros campos do formulário (Setor Origem etc., todos caixa "Selecionar...").
// Multi-seleção continua via Popover+Checkbox (Radix Select não suporta
// múltiplos valores nativamente) -- só a aparência do gatilho/lista que
// virou consistente com o resto.
export function SeletorAreaResponsavel({
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
  className,
  placeholder = "Selecionar...",
  opcaoTodas,
}: {
  value: AreaResponsavel[];
  onChange: (areas: AreaResponsavel[]) => void;
  id?: string;
  "aria-label"?: string;
  // Mesmo motivo de className em SelectTrigger: o gatilho precisa de
  // largura/altura diferentes em FormNovaDemanda (campo de formulário,
  // w-full) e em KanbanFiltros (pill de filtro, w-auto/h-8 igual aos
  // outros -- achado no dogfooding: sem isso o filtro ficava esticado a
  // largura toda, destoando das outras pills ao lado).
  className?: string;
  // Default combina com os outros campos do formulário (Tipo de Gestão,
  // Unidade etc., todos "Selecionar..."); KanbanFiltros passa algo no
  // padrão "Todas as X" dos filtros vizinhos (Setor Origem, Responsável).
  placeholder?: string;
  // Item extra no topo da lista, tipo "Todos os setores origem" dos filtros
  // vizinhos -- mas ali é single-select (marca UM item); aqui, "selecionar
  // todas" precisa de comportamento próprio de multi-seleção: marca as 4 de
  // uma vez quando nenhuma (ou só algumas) está marcada, desmarca todas
  // quando as 4 já estão marcadas. Opcional -- só KanbanFiltros usa (achado
  // no dogfooding); FormNovaDemanda não tem equivalente pedido ainda.
  opcaoTodas?: string;
}) {
  function alternar(area: AreaResponsavel) {
    onChange(
      value.includes(area) ? value.filter((existente) => existente !== area) : [...value, area],
    );
  }

  const todasMarcadas = value.length === AREAS_RESPONSAVEL.length;

  function alternarTodas() {
    onChange(todasMarcadas ? [] : [...AREAS_RESPONSAVEL]);
  }

  // Nomes concatenados crescem sem limite (achado no dogfooding: com w-auto
  // no filtro do Kanban, o botão empurrava os filtros vizinhos pra fora da
  // tela -- e o catálogo, mesmo fixo em 4 hoje, não devia ditar layout por
  // capricho). Prioridade do texto mostrado: (1) todas marcadas + opcaoTodas
  // definida -- mostra esse rótulo (ex.: "Todas as áreas responsáveis",
  // truncado), mais natural que uma contagem quando é exatamente esse o
  // caso; (2) mais de 2 marcadas (parcial) -- mostra só a contagem; (3) até
  // 2 marcadas -- nomes concatenados. O texto completo continua acessível
  // via title (tooltip nativo) e leitor de tela. max-w-* + truncate no
  // botão é a segunda camada, pro caso de até 2 nomes (ou um catálogo com
  // nomes mais longos no futuro) ainda estourar a largura.
  const nomesSelecionados = value.map((area) => LABEL_AREA_RESPONSAVEL[area]);
  const rotulo =
    value.length === 0
      ? null
      : todasMarcadas && opcaoTodas
        ? opcaoTodas
        : value.length > 2
          ? `${value.length} selecionadas`
          : nomesSelecionados.join(", ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          title={nomesSelecionados.length > 0 ? nomesSelecionados.join(", ") : undefined}
          className={cn(
            "flex h-9 w-full max-w-64 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
            className,
          )}
        >
          <span className={cn("truncate text-left", !rotulo && "text-muted-foreground")}>
            {rotulo ?? placeholder}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        {/* max-h + scroll (mesmo padrão de SeletorEtiquetas.tsx): o
            catálogo é fixo em 4 hoje, mas a lista não devia depender disso
            pra não crescer sem limite pela tela -- acompanha se o catálogo
            crescer, sem precisar lembrar de adicionar isso depois. */}
        <div className="scrollbar-discreta max-h-48 overflow-y-auto">
          {opcaoTodas && (
            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
              <Checkbox
                checked={todasMarcadas}
                onCheckedChange={alternarTodas}
                className="shrink-0"
              />
              <span className="truncate">{opcaoTodas}</span>
            </label>
          )}
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
