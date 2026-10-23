"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  CONFIG_DO_GRAFICO_DE_AUSENCIAS,
  textoDoPercentualDoLado,
  type ComposicaoDasAusencias,
  type LadoDaAusencia,
} from "@/lib/gestaoRHAbsenteismo";
import { formatarHoras } from "@/lib/gestaoRHHorasExtras";

const CONFIG = CONFIG_DO_GRAFICO_DE_AUSENCIAS satisfies ChartConfig;

/**
 * Rosca do justificado × injustificado na aba Absenteísmo (STC-848), no
 * padrão dos gráficos de Horas Extras: Recharts no `ChartContainer`, cores
 * da paleta pela config e a dica do shadcn. O total fica no centro.
 * Carregada à parte, para o Recharts não pesar na abertura do modal.
 */
export function GraficoComposicaoAusencias({ composicao }: { composicao: ComposicaoDasAusencias }) {
  return (
    <div className="relative size-32 shrink-0">
      <ChartContainer config={CONFIG} className="aspect-square size-32">
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                nameKey="lado"
                formatter={(_valor, _nome, item) => {
                  const parte = item.payload as ComposicaoDasAusencias["partes"][number];
                  return (
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">{CONFIG[parte.lado].label}</span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {formatarHoras(parte.minutos)} ·{" "}
                        {textoDoPercentualDoLado(parte, composicao.totalMinutos)}
                      </span>
                    </span>
                  );
                }}
              />
            }
          />
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
