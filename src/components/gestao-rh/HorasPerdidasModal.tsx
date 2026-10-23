"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  CONFIG_DO_GRAFICO_DE_AUSENCIAS,
  TIPO_DE_AUSENCIA,
  percentualDoTotal,
} from "@/lib/gestaoRHAbsenteismo";
import { formatarHoras, formatarHorasDoEixo } from "@/lib/gestaoRHHorasExtras";
import { cn } from "@/lib/utils";
import type { HorasPerdidasPainel } from "@/types/gestaoRH";

// Mesmas medidas das barras do Painel de Horas Extras.
const ALTURA_DA_BARRA = 34;
const ESPESSURA_DA_BARRA = 26;
const ROTULO = { largura: 170, caracteres: 22 };
const ROTULO_CELULAR = { largura: 96, caracteres: 11 };
// Espaço à direita da barra para o maior rótulo, "1.355:52:00 · 100%" (com
// "<1%" e ">99%" nas pontas).
const MARGEM_DO_VALOR = 140;

interface Barra {
  nome: string;
  minutos: number;
  horas: number;
  cor: string;
}

function cortar(nome: string, limite: number): string {
  return nome.length > limite ? `${nome.slice(0, limite - 1).trimEnd()}…` : nome;
}

function GraficoDeBarras({
  titulo,
  barras,
  total,
  alturaEmBarras,
}: {
  titulo: string;
  barras: Barra[];
  total: number;
  /**
   * Lado a lado, a altura do gráfico com mais barras, para os eixos ficarem
   * na mesma linha (como nas Horas Extras); as barras a menos se espaçam.
   */
  alturaEmBarras: number | null;
}) {
  const rotulo = useMediaQuery("(max-width: 639px)") ? ROTULO_CELULAR : ROTULO;
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h3 className="text-[14px] font-semibold">{titulo}</h3>
      {/* A lista para leitor de tela traz os mesmos números do gráfico. */}
      <ul className="sr-only">
        {barras.map((barra) => (
          <li key={barra.nome}>
            {barra.nome}: {formatarHoras(barra.minutos)}, {percentualDoTotal(barra.minutos, total)}
          </li>
        ))}
      </ul>
      <div aria-hidden>
        <ChartContainer
          config={{}}
          className="aspect-auto w-full text-[12px] [&_[tabindex]:focus]:outline-none"
          style={{ height: Math.max(barras.length, alturaEmBarras ?? 0) * ALTURA_DA_BARRA + 32 }}
        >
          <BarChart
            data={barras}
            layout="vertical"
            margin={{ top: 0, right: MARGEM_DO_VALOR, left: 0, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              dataKey="horas"
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tickFormatter={formatarHorasDoEixo}
            />
            <YAxis
              type="category"
              dataKey="nome"
              width={rotulo.largura}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickFormatter={(nome: string) => cortar(nome, rotulo.caracteres)}
            />
            <Bar
              dataKey="horas"
              radius={[0, 4, 4, 0]}
              maxBarSize={ESPESSURA_DA_BARRA}
              isAnimationActive={false}
            >
              {barras.map((barra) => (
                <Cell key={barra.nome} fill={barra.cor} />
              ))}
              <LabelList
                dataKey="minutos"
                position="right"
                className="fill-foreground tabular-nums"
                formatter={(minutos) =>
                  `${formatarHoras(Number(minutos))} · ${percentualDoTotal(Number(minutos), total, true)}`
                }
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </section>
  );
}

/**
 * Horas perdidas do período abertas por tipo e por unidade (STC-868), ao
 * clicar no card do Painel. Os dados vêm da mesma busca do Painel
 * (`horas_perdidas`, STC-867), no mesmo período e recorte. Barras, não
 * pizza: com vários tipos, a pizza dificulta comparar.
 */
export function HorasPerdidasModal({
  horasPerdidas,
  totalMinutos,
  nomeDoPeriodo,
  visao,
  onFechar,
}: {
  horasPerdidas: HorasPerdidasPainel;
  totalMinutos: number;
  nomeDoPeriodo: string;
  /** "Todas as unidades", o nome da unidade filtrada ou "Sua unidade". */
  visao: string;
  onFechar: () => void;
}) {
  const porTipo: Barra[] = horasPerdidas.por_tipo
    .filter((item) => item.minutos > 0)
    .toSorted((a, b) => b.minutos - a.minutos)
    .map((item) => ({
      nome: TIPO_DE_AUSENCIA[item.tipo].rotulo,
      minutos: item.minutos,
      horas: item.minutos / 60,
      cor: CONFIG_DO_GRAFICO_DE_AUSENCIAS[TIPO_DE_AUSENCIA[item.tipo].lado].color,
    }));
  const porUnidade: Barra[] = horasPerdidas.por_unidade.map((item) => ({
    nome: item.unidade?.nome ?? "Sem unidade",
    minutos: item.minutos,
    horas: item.minutos / 60,
    cor: "var(--secondary)",
  }));
  // Lado a lado a partir de 1024 px, como os gráficos de Horas Extras: o
  // modal cabe na tela sem rolar. Empilhados, cada um com a própria altura.
  const comUnidades = porUnidade.length > 1;
  const ladoALado = useMediaQuery("(min-width: 1024px)") && comUnidades;
  const alturaEmBarras = ladoALado ? Math.max(porTipo.length, porUnidade.length) : null;
  const lados = [
    { lado: "injustificado", minutos: horasPerdidas.minutos_injustificados },
    { lado: "justificado", minutos: horasPerdidas.minutos_justificados },
  ] as const;

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="scrollbar-discreta max-h-[90dvh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Horas perdidas · {nomeDoPeriodo}</DialogTitle>
          <DialogDescription
            className="text-[15px]"
            title="Conta quem trabalhou no período, inclusive desligados."
          >
            {visao} · {formatarHoras(totalMinutos)} no total
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          {lados.map(({ lado, minutos }) => (
            <li key={lado} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: CONFIG_DO_GRAFICO_DE_AUSENCIAS[lado].color }}
              />
              <span className="text-muted-foreground">{CONFIG_DO_GRAFICO_DE_AUSENCIAS[lado].label}</span>
              <span className="font-medium text-foreground tabular-nums">
                {formatarHoras(minutos)} · {percentualDoTotal(minutos, totalMinutos)}
              </span>
            </li>
          ))}
        </ul>

        <div className={cn("grid gap-3", comUnidades && "lg:grid-cols-2")}>
          <GraficoDeBarras
            titulo="Por tipo"
            barras={porTipo}
            total={totalMinutos}
            alturaEmBarras={alturaEmBarras}
          />
          {/* Com uma unidade só, a seção repetiria o total. */}
          {comUnidades && (
            <GraficoDeBarras
              titulo="Por unidade"
              barras={porUnidade}
              total={totalMinutos}
              alturaEmBarras={alturaEmBarras}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
