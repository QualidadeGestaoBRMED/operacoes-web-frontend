"use client";

import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import {
  CONFIG_DO_GRAFICO_DE_AUSENCIAS,
  type ComposicaoDasAusencias,
  type LadoDaAusencia,
} from "@/lib/gestaoRHAbsenteismo";
import { formatarHoras } from "@/lib/gestaoRHHorasExtras";

const CONFIG = CONFIG_DO_GRAFICO_DE_AUSENCIAS satisfies ChartConfig;

/**
 * Rosca do justificado × injustificado na aba Absenteísmo (STC-848), no
 * padrão dos gráficos de Horas Extras: Recharts no `ChartContainer` e cores
 * da paleta pela config. O total fica no centro. Sem dica ao passar o mouse:
 * numa rosca deste tamanho ela cobria o total, e a legenda ao lado já traz
 * as horas e o percentual de cada lado. Carregada à parte, para o Recharts
 * não pesar na abertura do modal.
 */
export function GraficoComposicaoAusencias({ composicao }: { composicao: ComposicaoDasAusencias }) {
  return (
    <div className="relative size-32 shrink-0">
      <ChartContainer config={CONFIG} className="aspect-square size-32">
        <PieChart>
          <Pie
            data={composicao.partes}
            dataKey="minutos"
            nameKey="lado"
            innerRadius="64%"
            outerRadius="100%"
            paddingAngle={composicao.partes.every((parte) => parte.minutos > 0) ? 3 : 0}
            cornerRadius={4}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            {composicao.partes.map((parte) => (
              <Cell key={parte.lado} fill={`var(--color-${parte.lado satisfies LadoDaAusencia})`} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] font-semibold text-foreground tabular-nums">
          {formatarHoras(composicao.totalMinutos)}
        </span>
        <span className="text-[10.5px] text-muted-foreground">no total</span>
      </div>
    </div>
  );
}
