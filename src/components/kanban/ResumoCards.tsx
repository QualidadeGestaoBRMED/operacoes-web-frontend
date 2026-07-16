"use client";

import { AlertTriangle, Info, UserRoundX, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useResumoDemandas } from "@/hooks/useResumoDemandas";
import { cn } from "@/lib/utils";
import type { EstatisticaResumo } from "@/types";

// "em andamento" fica de fora de propósito: a própria coluna "Em Andamento"
// do board já mostra essa contagem, então o card aqui seria redundante --
// só entram métricas que não têm equivalente visível de relance no board.
const ROTULOS_EXIBIDOS = new Set(["atrasadas", "sem responsável"]);

const ICONE_POR_ROTULO: Record<string, LucideIcon> = {
  atrasadas: AlertTriangle,
  "sem responsável": UserRoundX,
};

function CardEstatistica({ valor, rotulo, atencao }: EstatisticaResumo) {
  const Icon = ICONE_POR_ROTULO[rotulo] ?? Info;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border border-border p-4",
        atencao
          ? "bg-[color-mix(in_srgb,var(--destructive)_10%,var(--card))]"
          : "bg-[color-mix(in_srgb,var(--secondary)_10%,var(--card))]",
      )}
    >
      <div>
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {rotulo}
        </div>
        <div
          className={cn(
            "mt-1 text-3xl font-bold",
            atencao ? "text-destructive" : "text-secondary",
          )}
        >
          {valor}
        </div>
      </div>
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          atencao ? "bg-destructive/15 text-destructive" : "bg-secondary/15 text-secondary",
        )}
      >
        <Icon className="size-4" />
      </div>
    </div>
  );
}

// KPIs de "de relance" acima do board -- inspirado nas telas do ProntuAI
// (Pendentes/Aprovados/Rejeitados). Reaproveita o /resumo/ que já existia
// pra Hub (hoje bloqueada) em vez de criar um endpoint novo.
export function ResumoCards() {
  const { resumo, isLoading, error } = useResumoDemandas();

  if (error) return null;

  if (isLoading || !resumo) {
    return (
      <div className="grid grid-cols-1 gap-3 px-7 pt-5 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
    );
  }

  const estatisticas = resumo.estatisticas.filter((e) => ROTULOS_EXIBIDOS.has(e.rotulo));
  if (estatisticas.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 px-7 pt-5 sm:grid-cols-2">
      {estatisticas.map((estatistica) => (
        <CardEstatistica key={estatistica.rotulo} {...estatistica} />
      ))}
    </div>
  );
}
