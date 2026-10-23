"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CONFIG_DO_GRAFICO_DE_AUSENCIAS,
  textoDoPercentualDoLado,
  type ComposicaoDasAusencias,
} from "@/lib/gestaoRHAbsenteismo";
import { formatarHoras } from "@/lib/gestaoRHHorasExtras";

// Carregado à parte: o Recharts não pesa na abertura dos modais.
const GraficoComposicaoAusencias = dynamic(
  () => import("./GraficoComposicaoAusencias").then((modulo) => modulo.GraficoComposicaoAusencias),
  { ssr: false, loading: () => <Skeleton className="size-32 shrink-0 rounded-full" /> },
);

const DETALHE_DO_LADO = {
  injustificado: "falta, atraso, saída antecipada e jornada incompleta",
  justificado: "atestado e ausência justificada",
} as const;

/**
 * Rosca do justificado × injustificado com a legenda ao lado (STC-848),
 * usada na aba Absenteísmo do colaborador e nas horas perdidas do Painel
 * (STC-868). Quem usa põe o título e a moldura. A rosca fica escondida do
 * leitor de tela; a legenda traz os números.
 */
export function ComposicaoComLegenda({ composicao }: { composicao: ComposicaoDasAusencias }) {
  return (
    <div className="flex items-center gap-4">
      <div aria-hidden>
        <GraficoComposicaoAusencias composicao={composicao} />
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-[12.5px]">
        {composicao.partes.map((parte) => (
          <li key={parte.lado} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1 size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: CONFIG_DO_GRAFICO_DE_AUSENCIAS[parte.lado].color }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium text-foreground">
                  {CONFIG_DO_GRAFICO_DE_AUSENCIAS[parte.lado].label}
                </span>
                <span className="text-foreground tabular-nums">
                  {formatarHoras(parte.minutos)} ·{" "}
                  <span className="font-semibold">
                    {textoDoPercentualDoLado(parte, composicao.totalMinutos)}
                  </span>
                </span>
              </span>
              <span className="block text-[11.5px] text-muted-foreground">
                {DETALHE_DO_LADO[parte.lado]}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
