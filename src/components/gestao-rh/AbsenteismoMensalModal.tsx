"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
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
import { useAbsenteismoMensal } from "@/hooks/useAbsenteismoGestaoRH";
import { formatarDataISO } from "@/lib/gestaoRH";
import {
  DICA_PONTOS_PERCENTUAIS,
  corDaDiferenca,
  diferencaEmPontos,
  formatarDiferenca,
  formatarPercentual,
  mesesPorExtenso,
  nomeCurtoDoMes,
  periodoEmAndamento,
} from "@/lib/gestaoRHAbsenteismo";
import { cn } from "@/lib/utils";
import type { MesAbsenteismoMensal } from "@/types/gestaoRH";

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
  /** "Todas as unidades", o nome da unidade filtrada ou "Sua unidade". */
  visao: string;
}

/**
 * Um ponto por mês. `fechado` desenha a linha cheia (meses que acabaram);
 * `andamento` desenha o trecho tracejado do último mês fechado até o mês em
 * andamento, cujo número ainda vai mudar.
 */
interface PontoDoMes {
  nome: string;
  percentual: number | null;
  fechado: number | null;
  andamento: number | null;
  parcial: boolean;
}

/** Mês com percentual: entra na tabela e no gráfico. */
function comDado(mes: MesAbsenteismoMensal): boolean {
  return !mes.futuro && mes.percentual_periodo !== null;
}

function pontosDoGrafico(meses: MesAbsenteismoMensal[], hoje: string): PontoDoMes[] {
  const pontos = meses.map((mes) => {
    const percentual = comDado(mes) ? Number(mes.percentual_periodo) : null;
    const parcial = periodoEmAndamento(mes, hoje);
    return {
      nome: nomeCurtoDoMes(mes.mes),
      percentual,
      fechado: parcial ? null : percentual,
      andamento: parcial ? percentual : null,
      parcial,
    };
  });
  // O trecho tracejado sai do mês anterior ao em andamento, se ele tiver dado.
  const indice = pontos.findIndex((ponto) => ponto.parcial && ponto.percentual !== null);
  if (indice > 0 && pontos[indice - 1].fechado !== null) {
    pontos[indice - 1].andamento = pontos[indice - 1].fechado;
  }
  return pontos;
}

/** Título de coluna abreviado no celular; o leitor de tela lê o nome completo. */
function TituloColuna({ completo, curto, dica }: { completo: string; curto: string; dica?: string }) {
  return (
    <th scope="col" className="py-1.5 pl-3 text-right font-semibold" title={dica}>
      <span className="hidden sm:inline">{completo}</span>
      <span className="sm:hidden" aria-hidden>
        {curto}
      </span>
      <span className="sr-only sm:hidden">{completo}</span>
    </th>
  );
}

function Ponto(props: { cx?: number; cy?: number; payload?: PontoDoMes; vazado: boolean }) {
  const { cx, cy, payload, vazado } = props;
  // Cada linha desenha só os pontos dela: a cheia, os meses fechados; a
  // tracejada, o mês em andamento (vazado: o número ainda vai mudar).
  if (cx == null || cy == null || !payload || payload.parcial !== vazado) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      stroke="var(--color-percentual)"
      strokeWidth={2}
      fill={vazado ? "var(--background)" : "var(--color-percentual)"}
    />
  );
}

function DicaDoMes({ active, payload }: { active?: boolean; payload?: { payload: PontoDoMes }[] }) {
  const ponto = payload?.[0]?.payload;
  if (!active || !ponto || ponto.percentual === null) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm shadow-xl">
      <span className="font-medium">{ponto.nome}</span>
      {ponto.parcial && <span className="text-muted-foreground"> (em andamento)</span>}:{" "}
      <span className="font-semibold">{formatarPercentual(String(ponto.percentual))}</span>
    </div>
  );
}

export function AbsenteismoMensalModal({
  aberto,
  onFechar,
  anoInicial,
  hoje,
  unidade,
  visao,
}: AbsenteismoMensalModalProps) {
  const anoAtual = Number(hoje.slice(0, 4));
  const anos = Array.from({ length: anoAtual - PRIMEIRO_ANO + 1 }, (_, indice) => anoAtual - indice);
  const [ano, setAno] = useState(Math.min(Math.max(anoInicial, PRIMEIRO_ANO), anoAtual));
  const { mensal, carregando, mensagemErro, recarregar } = useAbsenteismoMensal(aberto, ano, unidade);
  const meses = mensal?.meses;

  const pontos = meses ? pontosDoGrafico(meses, hoje) : [];
  // Limite da versão vigente no último mês com dado (pode mudar entre versões).
  const ultimoComDado = meses?.findLast(comDado);
  const limite = ultimoComDado?.meta_percentual ?? null;
  const maior = Math.max(0, ...pontos.map((ponto) => ponto.percentual ?? 0), limite ? Number(limite) : 0);
  // Marcas com passo fixo (0, 2, 4, 6...): com o teto livre, a última marca
  // ficava colada na anterior.
  const passo = maior > 10 ? 5 : maior > 4 ? 2 : 1;
  const teto = Math.max(passo, Math.ceil((maior * 1.2) / passo) * passo);
  const marcas = Array.from({ length: teto / passo + 1 }, (_, indice) => indice * passo);
  const linhas = (meses ?? []).filter(comDado);
  const semDado = (meses ?? []).filter((mes) => !mes.futuro && !comDado(mes)).map((mes) => mes.mes);

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Absenteísmo mês a mês</DialogTitle>
          {/* O Painel só traz quem está ativo hoje: desligados não entram nos meses anteriores. */}
          <DialogDescription className="text-[15px]" title="Considera os colaboradores ativos hoje.">{visao}</DialogDescription>
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
            className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-[14px] text-destructive"
          >
            Não foi possível carregar o absenteísmo de {ano}.
            <Button type="button" variant="outline" size="sm" onClick={recarregar}>
              Tentar novamente
            </Button>
          </div>
        ) : carregando || !meses ? (
          <Skeleton className="h-[300px] rounded-lg sm:h-[400px]" aria-label={`Carregando o absenteísmo de ${ano}`} />
        ) : (
          <>
            {/* O gráfico é decorativo para leitor de tela: a tabela abaixo
                traz os mesmos números. */}
            <div aria-hidden>
              <ChartContainer config={CONFIG_GRAFICO} className="aspect-auto h-[260px] w-full text-[11px] sm:h-[360px] sm:text-[13px]">
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
                  {limite && (
                    <ReferenceLine
                      y={Number(limite)}
                      stroke="var(--destructive)"
                      strokeDasharray="4 4"
                      label={{
                        value: `limite ${formatarPercentual(limite)}`,
                        position: "insideTopRight",
                        fontSize: 13,
                        fill: "var(--muted-foreground)",
                      }}
                    />
                  )}
                  <Tooltip content={<DicaDoMes />} cursor={false} />
                  <Line
                    dataKey="fechado"
                    type="linear"
                    stroke="var(--color-percentual)"
                    strokeWidth={2}
                    dot={<Ponto vazado={false} />}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="andamento"
                    type="linear"
                    stroke="var(--color-percentual)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={<Ponto vazado />}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
            </div>

            {linhas.length === 0 ? (
              <p className="text-[15px] text-muted-foreground">Sem dados de absenteísmo em {ano}.</p>
            ) : (
              <table className="w-full text-[13px] sm:text-[15px]">
                <caption className="sr-only">Absenteísmo de {ano} por mês</caption>
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold tracking-wide sm:text-[12px] text-muted-foreground uppercase">
                    <th scope="col" className="py-1.5 font-semibold">
                      Mês
                    </th>
                    <TituloColuna completo="Absenteísmo" curto="Abs." />
                    <TituloColuna completo="vs. mês anterior" curto="Var." dica={DICA_PONTOS_PERCENTUAIS} />
                    <TituloColuna completo="Crítica" curto="Crít." />
                    <TituloColuna completo="Atenção" curto="Aten." />
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((mes) => {
                    // Variação para o mês de calendário anterior; janeiro não tem
                    // o anterior neste ano.
                    const anterior = meses.find((outro) => outro.mes === mes.mes - 1);
                    const pontosDoMes = anterior
                      ? diferencaEmPontos(mes.percentual_periodo, anterior.percentual_periodo)
                      : null;
                    const emAndamento = periodoEmAndamento(mes, hoje);
                    const dadosAte = mensal?.dados_ate;
                    return (
                      <tr key={mes.mes} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 text-left font-medium">
                          {nomeCurtoDoMes(mes.mes)}
                          {/* Mês em andamento: até onde vão os dados, no lugar de um selo. */}
                          {emAndamento && (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {dadosAte ? `até ${formatarDataISO(dadosAte).slice(0, 5)}` : "em andamento"}
                            </span>
                          )}
                        </th>
                        <td className="py-2 pl-3 text-right font-semibold">
                          {formatarPercentual(mes.percentual_periodo)}
                        </td>
                        <td
                          className={cn(
                            "py-2 pl-3 text-right font-semibold whitespace-nowrap",
                            pontosDoMes !== null && corDaDiferenca(pontosDoMes),
                          )}
                        >
                          {pontosDoMes !== null && formatarDiferenca(pontosDoMes)}
                        </td>
                        {/* Sem faixas na versão dos parâmetros do mês, ninguém é classificado. */}
                        {mes.faixas_cadastradas ? (
                          <>
                            <td className="py-2 pl-3 text-right text-red-600">{mes.faixa_critica}</td>
                            <td className="py-2 pl-3 text-right text-amber-700">{mes.faixa_atencao}</td>
                          </>
                        ) : (
                          <td colSpan={2} className="py-2 pl-3 text-right text-[12px] text-muted-foreground sm:text-[13.5px]">
                            sem faixas
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {semDado.length > 0 && linhas.length > 0 && (
              <p className="text-[11.5px] text-muted-foreground sm:text-[13px]">Sem dados: {mesesPorExtenso(semDado)}.</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
