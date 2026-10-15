"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatarHoras, formatarHorasDoEixo, minutosDoFator, rotuloDoFator } from "@/lib/gestaoRHHorasExtras";
import { cn } from "@/lib/utils";
import type { FatorHoraExtra, LinhaHorasExtras, MinutosDoFator, PainelHorasExtras } from "@/types/gestaoRH";

const MAXIMO_DE_BARRAS = 10;
const FATORES: FatorHoraExtra[] = ["1", "2"];
const ALTURA_DA_BARRA = 34;
// Os nomes vêm do VR em maiúsculas, mais largos: o corte em caracteres
// precisa caber na largura do eixo, menor no celular para sobrar barra.
const ROTULO = { largura: 170, caracteres: 19 };
const ROTULO_CELULAR = { largura: 112, caracteres: 11 };
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
  colaboradores?: number;
}

function barra(item: Item): Barra {
  const minutos_1 = minutosDoFator(item.minutos_por_fator, "1");
  const minutos_2 = minutosDoFator(item.minutos_por_fator, "2");
  return {
    nome: item.nome,
    fator_1: minutos_1 / 60,
    fator_2: minutos_2 / 60,
    minutos_1,
    minutos_2,
    total: item.total_minutos,
    linha: item.linha,
    colaboradores: item.colaboradores,
  };
}

function cortar(nome: string, limite: number): string {
  return nome.length > limite ? `${nome.slice(0, limite - 1).trimEnd()}…` : nome;
}

/** Rótulo do eixo cortado com reticências; o nome inteiro fica na dica do navegador. */
function RotuloDoEixo(props: { x?: number; y?: number; payload?: { value: string }; caracteres: number }) {
  const { x, y, payload, caracteres } = props;
  if (x == null || y == null || !payload) return null;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" className="fill-muted-foreground">
      <title>{payload.value}</title>
      {cortar(payload.value, caracteres)}
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
      {/* Por cargo: muita gente com pouca hora extra ou pouca gente com muita. */}
      {item.colaboradores !== undefined && (
        <div className="text-muted-foreground">
          {item.colaboradores} {item.colaboradores === 1 ? "colaborador" : "colaboradores"} · média{" "}
          <span className="font-semibold text-foreground">
            {formatarHoras(Math.round(item.total / item.colaboradores))}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Legenda que também escolhe o fator: com um fator escolhido, o gráfico mostra
 * só ele e o ranking passa a ser por ele; clicar de novo volta aos dois.
 */
function SeletorDeFator({
  painel,
  fator,
  onEscolher,
}: {
  painel: PainelHorasExtras;
  fator: FatorHoraExtra | null;
  onEscolher: (fator: FatorHoraExtra | null) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-[12px]">
      {FATORES.map((item) => {
        const escolhido = fator === item;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={escolhido}
            onClick={() => onEscolher(escolhido ? null : item)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none",
              escolhido
                ? "border-border bg-muted text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              fator !== null && !escolhido && "opacity-60",
            )}
          >
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: CORES[`fator_${item}`] }} />
            {rotuloDoFator(item, painel)}
          </button>
        );
      })}
    </div>
  );
}

interface Item {
  nome: string;
  minutos_por_fator: MinutosDoFator[];
  total_minutos: number;
  linha?: LinhaHorasExtras;
  /** Agrupamento por cargo: quantos colaboradores do cargo fizeram hora extra. */
  colaboradores?: number;
}

/**
 * Soma por cargo dos colaboradores com hora extra (o cargo como vem do VR).
 * Com a unidade filtrada, mostra em que função a hora extra se concentra.
 */
function porCargo(linhas: LinhaHorasExtras[]): Item[] {
  const grupos = new Map<string, { minutos: Record<FatorHoraExtra, number>; total: number; colaboradores: number }>();
  for (const linha of linhas) {
    const cargo = linha.colaborador.cargo.trim() || "Sem cargo";
    const grupo = grupos.get(cargo) ?? { minutos: { "1": 0, "2": 0 }, total: 0, colaboradores: 0 };
    for (const fator of FATORES) grupo.minutos[fator] += minutosDoFator(linha.minutos_por_fator, fator);
    grupo.total += linha.total_minutos;
    grupo.colaboradores += 1;
    grupos.set(cargo, grupo);
  }
  return [...grupos].map(([nome, grupo]) => ({
    nome,
    minutos_por_fator: FATORES.map((fator) => ({ fator, minutos: grupo.minutos[fator] })),
    total_minutos: grupo.total,
    colaboradores: grupo.colaboradores,
  }));
}

/** Os 10 com mais horas: no total ou, com um fator escolhido, nele (sem quem tem zero nele). */
function maiores(itens: Item[], fator: FatorHoraExtra | null): Barra[] {
  const minutos = (item: Item) => (fator ? minutosDoFator(item.minutos_por_fator, fator) : item.total_minutos);
  return itens
    .filter((item) => minutos(item) > 0)
    .toSorted((a, b) => minutos(b) - minutos(a) || a.nome.localeCompare(b.nome))
    .slice(0, MAXIMO_DE_BARRAS)
    .map(barra);
}

function GraficoDeBarras({
  doQue,
  itens,
  painel,
  onClicar,
}: {
  /** "colaboradores", "unidades / equipes": entra no título. */
  doQue: string;
  itens: Item[];
  painel: PainelHorasExtras;
  onClicar?: (barra: Barra) => void;
}) {
  const [fator, setFator] = useState<FatorHoraExtra | null>(null);
  const barras = maiores(itens, fator);
  const titulo = `Top ${barras.length || MAXIMO_DE_BARRAS} ${doQue} em horas extras${fator ? ` ${rotuloDoFator(fator, painel)}` : ""}`;
  const visiveis = fator ? [fator] : FATORES;
  const config = {
    fator_1: { label: rotuloDoFator("1", painel), color: CORES.fator_1 },
    fator_2: { label: rotuloDoFator("2", painel), color: CORES.fator_2 },
  } satisfies ChartConfig;
  const clicar = onClicar && ((dado: { payload?: Barra }) => dado.payload && onClicar(dado.payload));
  const rotulo = useMediaQuery("(max-width: 639px)") ? ROTULO_CELULAR : ROTULO;

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold">{titulo}</h2>
        <SeletorDeFator painel={painel} fator={fator} onEscolher={setFator} />
      </div>
      {barras.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          Nenhuma hora extra {fator && rotuloDoFator(fator, painel)} no período.
        </p>
      ) : (
        // Decorativo para leitor de tela: a tabela traz os mesmos números.
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
                tickFormatter={formatarHorasDoEixo}
              />
              <YAxis
                type="category"
                dataKey="nome"
                width={rotulo.largura}
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={<RotuloDoEixo caracteres={rotulo.caracteres} />}
              />
              <Tooltip content={<Dica painel={painel} />} cursor={{ fillOpacity: 0.4 }} />
              {visiveis.map((item) => (
                <Bar
                  key={item}
                  dataKey={`fator_${item}`}
                  stackId="horas"
                  fill={`var(--color-fator_${item})`}
                  // Cantos arredondados só na ponta da barra.
                  radius={item === visiveis.at(-1) ? [0, 4, 4, 0] : undefined}
                  isAnimationActive={false}
                  onClick={clicar}
                  className={onClicar && "cursor-pointer"}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </section>
  );
}

interface GraficosHorasExtrasProps {
  painel: PainelHorasExtras;
  onAbrirColaborador: (linha: LinhaHorasExtras) => void;
}

export function GraficosHorasExtras({ painel, onAbrirColaborador }: GraficosHorasExtrasProps) {
  // Uma unidade só (Admin com a unidade filtrada, coordenação e OPEX, que só
  // recebem a própria): o gráfico por unidade teria uma barra, e o por cargo
  // mostra em que função a hora extra se concentra.
  const umaUnidade = painel.por_unidade.length <= 1;
  const colaboradores = painel.linhas.map((linha) => ({
    nome: linha.colaborador.nome,
    minutos_por_fator: linha.minutos_por_fator,
    total_minutos: linha.total_minutos,
    linha,
  }));

  return (
    <div className="grid gap-3 px-4 sm:px-7 xl:grid-cols-2">
      <GraficoDeBarras
        doQue="colaboradores"
        itens={colaboradores}
        painel={painel}
        onClicar={(item) => item.linha && onAbrirColaborador(item.linha)}
      />
      {/* `key`: o fator escolhido em um não passa para o outro. */}
      {umaUnidade ? (
        <GraficoDeBarras key="cargos" doQue="cargos" itens={porCargo(painel.linhas)} painel={painel} />
      ) : (
        <GraficoDeBarras key="unidades" doQue="unidades / equipes" itens={painel.por_unidade} painel={painel} />
      )}
    </div>
  );
}
