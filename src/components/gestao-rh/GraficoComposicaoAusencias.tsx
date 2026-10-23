"use client";

import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { COR_DO_LADO_DA_AUSENCIA, type ComposicaoDasAusencias } from "@/lib/gestaoRHAbsenteismo";
import { cn } from "@/lib/utils";

/**
 * Rosca do justificado × injustificado na aba Absenteísmo (STC-848).
 * Carregada à parte, para o Recharts não pesar na abertura do modal; a
 * legenda ao lado traz os mesmos números para o leitor de tela.
 */
export function GraficoComposicaoAusencias({ composicao }: { composicao: ComposicaoDasAusencias }) {
  return (
    <ChartContainer config={{}} className="aspect-square size-24 shrink-0">
      <PieChart>
        <Pie
          data={composicao.partes}
          dataKey="minutos"
          nameKey="lado"
          innerRadius="58%"
          outerRadius="100%"
          strokeWidth={2}
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
        >
          {composicao.partes.map((parte) => (
            <Cell
              key={parte.lado}
              // Classe e não `fill`: o CSS vence o atributo de cor do Recharts,
              // e a borda com a cor do card separa as fatias nos dois temas.
              className={cn(COR_DO_LADO_DA_AUSENCIA[parte.lado].preenchimento, "stroke-card")}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
