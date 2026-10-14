"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAbsenteismoMensal, type MesAbsenteismo } from "@/hooks/useAbsenteismoGestaoRH";
import {
  corDaDiferenca,
  diferencaEmPontos,
  formatarDiferenca,
  formatarPercentual,
  nomeCurtoDoMes,
  periodoEmAndamento,
} from "@/lib/gestaoRHAbsenteismo";
import { cn } from "@/lib/utils";
import type { CategoriaPainelAbsenteismo } from "@/types/gestaoRH";

// Primeiro ano com dados de ponto no Atlas (importação do VR desde set/2026).
const PRIMEIRO_ANO = 2026;

const CONFIG_GRAFICO = {
  percentual: { label: "Absenteísmo", color: "var(--secondary)" },
} satisfies ChartConfig;

interface AbsenteismoMensalModalProps {
  aberto: boolean;
  onFechar: () => void;
  /** Ano do período do Painel. */
  anoInicial: number;
  hoje: string;
  unidade: number | undefined;
  categoria: CategoriaPainelAbsenteismo | undefined;
  /** "Todas as unidades", o nome da unidade filtrada, com a categoria se houver. */
  visao: string;
}

interface PontoDoMes {
  nome: string;
  percentual: number | null;
  parcial: boolean;
}

/** Mês com percentual: entra na tabela e no gráfico. */
function comDado(mes: MesAbsenteismo): boolean {
  return mes.painel?.cards.percentual_periodo != null;
}

/** "jan a ago, nov e dez": meses passados ou em andamento sem dado. */
function mesesSemDado(meses: MesAbsenteismo[]): string | null {
  const nomes = meses.filter((mes) => !mes.futuro && !comDado(mes)).map((mes) => nomeCurtoDoMes(mes.mes));
  if (nomes.length === 0) return null;
  return nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

function Selo({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full bg-amber-600/10 px-1.5 py-px text-[10px] font-bold text-amber-800 uppercase">
      {children}
    </span>
  );
}

/** Título de coluna abreviado no celular; o leitor de tela lê o nome completo. */
function TituloColuna({ completo, curto }: { completo: string; curto: string }) {
  return (
    <th scope="col" className="py-1.5 pl-3 text-right font-semibold">
      <span className="hidden sm:inline">{completo}</span>
      <span className="sm:hidden" aria-hidden>
        {curto}
      </span>
      <span className="sr-only sm:hidden">{completo}</span>
    </th>
  );
}

function PontoDoGrafico(props: { cx?: number; cy?: number; payload?: PontoDoMes }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || payload?.percentual == null) return null;
  // Mês em andamento: ponto vazado, o número ainda vai mudar.
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      stroke="var(--color-percentual)"
      strokeWidth={2}
      fill={payload.parcial ? "var(--background)" : "var(--color-percentual)"}
    />
  );
}

export function AbsenteismoMensalModal({
  aberto,
  onFechar,
  anoInicial,
  hoje,
  unidade,
  categoria,
  visao,
}: AbsenteismoMensalModalProps) {
  const anoAtual = Number(hoje.slice(0, 4));
  const anos = Array.from({ length: anoAtual - PRIMEIRO_ANO + 1 }, (_, indice) => anoAtual - indice);
  const [ano, setAno] = useState(Math.min(Math.max(anoInicial, PRIMEIRO_ANO), anoAtual));
  const { meses, carregando, mensagemErro, recarregar } = useAbsenteismoMensal(
    aberto,
    ano,
    hoje,
    unidade,
    categoria,
  );

  const pontos: PontoDoMes[] = (meses ?? []).map((mes) => ({
    nome: nomeCurtoDoMes(mes.mes),
    percentual: comDado(mes) ? Number(mes.painel!.cards.percentual_periodo) : null,
    parcial: periodoEmAndamento(mes, hoje),
  }));
  // Meta da versão vigente no último mês com dado (pode mudar entre versões).
  const ultimoComDado = meses?.findLast(comDado);
  const meta = ultimoComDado?.painel?.parametros.meta_percentual ?? null;
  const maior = Math.max(0, ...pontos.map((ponto) => ponto.percentual ?? 0), meta ? Number(meta) : 0);
  // Marcas com passo fixo (0, 2, 4, 6...): com o teto livre, a última marca
  // ficava colada na anterior.
  const passo = maior > 10 ? 5 : maior > 4 ? 2 : 1;
  const teto = Math.max(passo, Math.ceil((maior * 1.2) / passo) * passo);
  const marcas = Array.from({ length: teto / passo + 1 }, (_, indice) => indice * passo);
  const linhas = (meses ?? []).filter(comDado);
  const semDado = meses ? mesesSemDado(meses) : null;

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Absenteísmo mês a mês</DialogTitle>
          <DialogDescription>{visao}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end">
          <Select value={String(ano)} onValueChange={(valor) => setAno(Number(valor))}>
            <SelectTrigger size="sm" className="h-8 w-auto" aria-label="Ano">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {anos.map((item) => (
                <SelectItem key={item} value={String(item)}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mensagemErro ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-[12.5px] text-destructive"
          >
            Não foi possível carregar o absenteísmo de {ano}.
            <Button type="button" variant="outline" size="sm" onClick={recarregar}>
              Tentar novamente
            </Button>
          </div>
        ) : carregando || !meses ? (
          <Skeleton className="h-[260px] rounded-lg" aria-label={`Carregando o absenteísmo de ${ano}`} />
        ) : (
          <>
            {/* O gráfico é decorativo para leitor de tela: a tabela abaixo
                traz os mesmos números. */}
            <div aria-hidden>
              <ChartContainer config={CONFIG_GRAFICO} className="aspect-auto h-[220px] w-full">
                <LineChart data={pontos} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="nome" tickLine={false} axisLine={false} interval={0} tickMargin={8} />
                  <YAxis
                    domain={[0, teto]}
                    ticks={marcas}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tickFormatter={(valor: number) => `${valor}%`}
                  />
                  {meta && (
                    <ReferenceLine
                      y={Number(meta)}
                      stroke="var(--destructive)"
                      strokeDasharray="4 4"
                      label={{
                        value: `meta ${formatarPercentual(meta)}`,
                        position: "insideTopRight",
                        fontSize: 11,
                        fill: "var(--muted-foreground)",
                      }}
                    />
                  )}
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(valor) => formatarPercentual(String(valor))}
                        hideIndicator
                      />
                    }
                  />
                  <Line
                    dataKey="percentual"
                    type="linear"
                    stroke="var(--color-percentual)"
                    strokeWidth={2}
                    dot={<PontoDoGrafico />}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
            </div>

            {linhas.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Sem dados de absenteísmo em {ano}.</p>
            ) : (
              <table className="w-full text-[13px]">
                <caption className="sr-only">Absenteísmo de {ano} por mês</caption>
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th scope="col" className="py-1.5 font-semibold">Mês</th>
                    <TituloColuna completo="Absenteísmo" curto="Abs." />
                    <TituloColuna completo="Variação" curto="Var." />
                    <TituloColuna completo="Crítica" curto="Crít." />
                    <TituloColuna completo="Atenção" curto="Aten." />
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((mes) => {
                    const painel = mes.painel!;
                    // Variação para o mês de calendário anterior; janeiro não tem
                    // o anterior neste ano.
                    const anterior = meses.find((outro) => outro.mes === mes.mes - 1);
                    const pontosDoMes = anterior?.painel
                      ? diferencaEmPontos(
                          painel.cards.percentual_periodo,
                          anterior.painel.cards.percentual_periodo,
                        )
                      : null;
                    const faixas = painel.parametros.faixas_cadastradas;
                    return (
                      <tr key={mes.mes} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 text-left font-medium">
                          <span className="flex flex-wrap items-center gap-1.5">
                            {nomeCurtoDoMes(mes.mes)}
                            {periodoEmAndamento(mes, hoje) && <Selo>Parcial</Selo>}
                            {painel.cards.colaboradores_provisorios > 0 && <Selo>Provisório</Selo>}
                          </span>
                        </th>
                        <td className="py-2 pl-3 text-right font-semibold">
                          {formatarPercentual(painel.cards.percentual_periodo)}
                        </td>
                        <td
                          className={cn(
                            "py-2 pl-3 text-right font-semibold whitespace-nowrap",
                            pontosDoMes !== null ? corDaDiferenca(pontosDoMes) : "text-muted-foreground",
                          )}
                        >
                          {pontosDoMes !== null ? formatarDiferenca(pontosDoMes) : "—"}
                        </td>
                        {/* Sem faixas na versão dos parâmetros do mês, ninguém é classificado. */}
                        <td className="py-2 pl-3 text-right text-red-600">
                          {faixas ? painel.cards.faixa_critica : "—"}
                        </td>
                        <td className="py-2 pl-3 text-right text-amber-700">
                          {faixas ? painel.cards.faixa_atencao : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {semDado && linhas.length > 0 && (
              <p className="text-[11.5px] text-muted-foreground">Sem dados: {semDado}.</p>
            )}
          </>
        )}

        <p className="text-[11.5px] text-muted-foreground">
          Considera os colaboradores ativos hoje, com os mesmos filtros de unidade e categoria do Painel.
        </p>
      </DialogContent>
    </Dialog>
  );
}
