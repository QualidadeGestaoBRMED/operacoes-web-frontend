"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatarHoras, minutosDoFator, rotuloDoFator } from "@/lib/gestaoRHHorasExtras";
import type { LinhaHorasExtras, MinutosDoFator, PainelHorasExtras } from "@/types/gestaoRH";

export const MAXIMO_DE_BARRAS = 10;
const ALTURA_DA_BARRA = 34;
const LARGURA_DO_ROTULO = 150;
const CORES = { fator_1: "var(--secondary)", fator_2: "var(--chart-4)" };

interface Barra {
  nome: string;
  /** Horas (com fração) para o eixo; os minutos vão para a dica. */
  fator_1: number;
  fator_2: number;
  minutos_1: number;
  minutos_2: number;
  total: number;
  linha?: LinhaHorasExtras;
}

function barra(nome: string, minutos: MinutosDoFator[], total: number, linha?: LinhaHorasExtras): Barra {
  const minutos_1 = minutosDoFator(minutos, "1");
  const minutos_2 = minutosDoFator(minutos, "2");
  return { nome, fator_1: minutos_1 / 60, fator_2: minutos_2 / 60, minutos_1, minutos_2, total, linha };
}

function cortar(nome: string, limite = 20): string {
  return nome.length > limite ? `${nome.slice(0, limite - 1).trimEnd()}…` : nome;
}

/** Rótulo do eixo cortado com reticências; o nome inteiro fica na dica do navegador. */
function RotuloDoEixo(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x, y, payload } = props;
  if (x == null || y == null || !payload) return null;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" className="fill-muted-foreground">
      <title>{payload.value}</title>
      {cortar(payload.value)}
    </text>
  );
}

function Dica({
  active,
  payload,
  painel,
}: {
  active?: boolean;
  payload?: { payload: Barra }[];
  painel: PainelHorasExtras;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px] shadow-xl">
      <div className="mb-1 font-medium">{item.nome}</div>
      <div className="text-muted-foreground">
        {rotuloDoFator("1", painel)}: <span className="font-semibold text-foreground">{formatarHoras(item.minutos_1)}</span>
      </div>
      <div className="text-muted-foreground">
        {rotuloDoFator("2", painel)}: <span className="font-semibold text-foreground">{formatarHoras(item.minutos_2)}</span>
      </div>
      <div className="mt-1 border-t border-border pt-1 font-semibold">Total: {formatarHoras(item.total)}</div>
    </div>
  );
}

function Legenda({ painel }: { painel: PainelHorasExtras }) {
  return (
    <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
      {(["1", "2"] as const).map((fator) => (
        <span key={fator} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: CORES[`fator_${fator}`] }} />
          {rotuloDoFator(fator, painel)}
        </span>
      ))}
    </div>
  );
}

function GraficoDeBarras({
  titulo,
  subtitulo,
  barras,
  painel,
  onClicar,
}: {
  titulo: string;
  subtitulo: string;
  barras: Barra[];
  painel: PainelHorasExtras;
  onClicar?: (barra: Barra) => void;
}) {
  const config = {
    fator_1: { label: rotuloDoFator("1", painel), color: CORES.fator_1 },
    fator_2: { label: rotuloDoFator("2", painel), color: CORES.fator_2 },
  } satisfies ChartConfig;
  const clicar = onClicar && ((dado: { payload?: Barra }) => dado.payload && onClicar(dado.payload));

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-semibold">{titulo}</h2>
          <p className="text-[12px] text-muted-foreground">{subtitulo}</p>
        </div>
        <Legenda painel={painel} />
      </div>
      {/* Decorativo para leitor de tela: a tabela traz os mesmos números. */}
      <div aria-hidden>
        <ChartContainer
          config={config}
          className="aspect-auto w-full text-[12px]"
          style={{ height: barras.length * ALTURA_DA_BARRA + 32 }}
        >
          <BarChart data={barras} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tickFormatter={(horas: number) => `${horas}h`}
            />
            <YAxis
              type="category"
              dataKey="nome"
              width={LARGURA_DO_ROTULO}
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={<RotuloDoEixo />}
            />
            <Tooltip content={<Dica painel={painel} />} cursor={{ fillOpacity: 0.4 }} />
            <Bar
              dataKey="fator_1"
              stackId="horas"
              fill="var(--color-fator_1)"
              isAnimationActive={false}
              onClick={clicar}
              className={onClicar && "cursor-pointer"}
            />
            <Bar
              dataKey="fator_2"
              stackId="horas"
              fill="var(--color-fator_2)"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
              onClick={clicar}
              className={onClicar && "cursor-pointer"}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </section>
  );
}

/** "top 10 do período · 50% + 100%", com os percentuais da rota. */
function subtitulo(painel: PainelHorasExtras, quantidade: number, total: number): string {
  const fatores = `${rotuloDoFator("1", painel)} + ${rotuloDoFator("2", painel)}`;
  const recorte = total > quantidade ? `top ${quantidade} de ${total} do período` : "todos do período";
  return `${recorte} · ${fatores}`;
}

interface GraficosHorasExtrasProps {
  painel: PainelHorasExtras;
  /** Unidade filtrada: o gráfico por unidade teria uma barra só e some. */
  comUnidadeFiltrada: boolean;
  onAbrirColaborador: (linha: LinhaHorasExtras) => void;
}

export function GraficosHorasExtras({ painel, comUnidadeFiltrada, onAbrirColaborador }: GraficosHorasExtrasProps) {
  const colaboradores = painel.linhas
    .slice(0, MAXIMO_DE_BARRAS)
    .map((linha) => barra(linha.colaborador.nome, linha.minutos_por_fator, linha.total_minutos, linha));
  const unidades = painel.por_unidade
    .slice(0, MAXIMO_DE_BARRAS)
    .map((grupo) => barra(grupo.nome, grupo.minutos_por_fator, grupo.total_minutos));

  return (
    <div className="grid gap-3 px-4 sm:px-7 xl:grid-cols-2">
      <GraficoDeBarras
        titulo="Horas extras por colaborador"
        subtitulo={subtitulo(painel, colaboradores.length, painel.linhas.length)}
        barras={colaboradores}
        painel={painel}
        onClicar={(item) => item.linha && onAbrirColaborador(item.linha)}
      />
      {!comUnidadeFiltrada && (
        <GraficoDeBarras
          titulo="Horas extras por unidade / equipe"
          subtitulo={subtitulo(painel, unidades.length, painel.por_unidade.length)}
          barras={unidades}
          painel={painel}
        />
      )}
    </div>
  );
}
