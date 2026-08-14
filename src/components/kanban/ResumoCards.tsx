"use client";

import { Activity, AlertTriangle, Info, UserRoundX, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useResumoDemandas } from "@/hooks/useResumoDemandas";
import { cn } from "@/lib/utils";
import type { DemandaFiltros, EstatisticaResumo } from "@/types";

// Ordem de exibição = ordem que o backend já devolve em resumo.estatisticas
// (em andamento, atrasadas, sem responsável) -- o filter() abaixo preserva
// essa ordem, não precisa reordenar aqui.
const ROTULOS_EXIBIDOS = new Set(["em andamento", "atrasadas", "sem responsável"]);

const ICONE_POR_ROTULO: Record<string, LucideIcon> = {
  "em andamento": Activity,
  atrasadas: AlertTriangle,
  "sem responsável": UserRoundX,
};

function CardEstatistica({
  valor,
  rotulo,
  atencao,
  ativo,
  onClick,
}: EstatisticaResumo & { ativo: boolean; onClick: () => void }) {
  const Icon = ICONE_POR_ROTULO[rotulo] ?? Info;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        // Achado na avaliação de UX mobile (pós-STC-186): p-4/text-3xl/
        // size-9 fixos faziam os 2 cards, empilhados, tomarem uma tela
        // inteira de altura em 375px antes do usuário ver qualquer demanda.
        // Reduzido por padrão (telas estreitas) e restaurado ao tamanho
        // original a partir de sm -- zero mudança visual em tablet/desktop.
        // min-w-0: achado na avaliação de UX mobile (3 cards, STC-267) --
        // "RESPONSÁVEL"/"ANDAMENTO" são palavras únicas, sem espaço pra
        // quebrar; sem min-w-0 (grid-template-columns não encolhe um item
        // abaixo do min-content dele por padrão), a 3ª coluna do grid
        // crescia além de 1fr pra caber a palavra inteira, empurrando o
        // ícone (shrink-0) pra fora da viewport em telas estreitas (360px).
        "flex min-w-0 items-center justify-between rounded-xl border p-2.5 text-left transition-shadow sm:p-4",
        atencao
          ? "bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))]"
          : "bg-[color-mix(in_srgb,var(--secondary)_10%,var(--card))]",
        ativo
          ? atencao
            ? "border-destructive ring-2 ring-destructive/40"
            : "border-secondary ring-2 ring-secondary/40"
          : "border-border",
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[10.5px] leading-tight font-semibold text-muted-foreground uppercase sm:tracking-wide sm:text-xs">
          {rotulo}
        </div>
        <div
          className={cn(
            "mt-0.5 text-xl font-bold sm:mt-1 sm:text-3xl",
            atencao ? "text-destructive" : "text-secondary",
          )}
        >
          {valor}
        </div>
      </div>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full sm:size-9",
          atencao ? "bg-destructive/15 text-destructive" : "bg-secondary/15 text-secondary",
        )}
      >
        <Icon className="size-3.5 sm:size-4" />
      </div>
    </button>
  );
}

interface ResumoCardsProps {
  filtros?: DemandaFiltros;
  focoAtivo?: string | null;
  onFocoClick?: (rotulo: string) => void;
  pausarPolling?: boolean;
  desabilitado?: boolean;
}

// KPIs de "de relance" acima do board -- inspirado nas telas do ProntuAI
// (Pendentes/Aprovados/Rejeitados). Reaproveita o /resumo/ que já existia
// pra Hub (hoje bloqueada) em vez de criar um endpoint novo. Clicáveis:
// funcionam como atalho pra filtrar o board só pelas demandas daquela
// métrica (ex.: só as atrasadas), sem precisar de um filtro dedicado.
export function ResumoCards({
  filtros,
  focoAtivo,
  onFocoClick,
  pausarPolling,
  desabilitado,
}: ResumoCardsProps) {
  const { resumo, isFilterChangeValidating, carregandoPrimeiraVez, error } = useResumoDemandas(
    filtros,
    { pausado: pausarPolling, desabilitado },
  );

  if (error) return null;

  if (carregandoPrimeiraVez || !resumo) {
    return (
      <div className="grid grid-cols-3 gap-2 px-4 pt-4 sm:gap-3 sm:px-7 sm:pt-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] rounded-xl sm:h-[72px]" />
        ))}
      </div>
    );
  }

  const estatisticas = resumo.estatisticas.filter((e) => ROTULOS_EXIBIDOS.has(e.rotulo));
  if (estatisticas.length === 0) return null;

  return (
    <div
      className={cn(
        // grid-cols-3 sempre (não sm:grid-cols-3): mesmo critério de antes
        // (ver CardEstatistica) -- condensa os 3 KPIs numa linha só compacta
        // em qualquer largura, em vez de empilhar em mobile.
        "grid grid-cols-3 gap-2 px-4 pt-4 transition-opacity sm:gap-3 sm:px-7 sm:pt-5",
        // Troca de filtro: mantém os cards antigos visíveis (keepPreviousData
        // no hook) em vez de sumir pra um skeleton -- só esmaece um pouco
        // enquanto a resposta nova não chega, pra não parecer travado.
        isFilterChangeValidating && "opacity-60",
      )}
    >
      {estatisticas.map((estatistica) => (
        <CardEstatistica
          key={estatistica.rotulo}
          {...estatistica}
          ativo={focoAtivo === estatistica.rotulo}
          onClick={() => onFocoClick?.(estatistica.rotulo)}
        />
      ))}
    </div>
  );
}
