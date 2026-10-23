"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAbsenteismoColaborador } from "@/hooks/useAbsenteismoGestaoRH";
import { usePeriodoEditavel, type Periodo } from "@/hooks/usePeriodoEditavel";
import { formatarDataISO } from "@/lib/gestaoRH";
import {
  COR_FAIXA,
  ROTULO_ACAO_TRATAMENTO,
  ROTULO_FAIXA,
  composicaoDasAusencias,
  formatarPercentual,
  formatarSaldoHoras,
  textoOcorrencia,
  tituloAlerta,
} from "@/lib/gestaoRHAbsenteismo";
import { cn, formatarDataHora } from "@/lib/utils";
import type { AcaoTratamento, AlertaAbsenteismo } from "@/types/gestaoRH";
import { CampoPeriodo } from "./CampoPeriodo";
import { ComposicaoComLegenda } from "./ComposicaoComLegenda";
import { BotaoAnexos, BotaoConversa, type ConversaAberta } from "./ConversaDoAlerta";
import { FormRegistrarTratamento } from "./FormRegistrarTratamento";
import { HistoricoRH } from "./HistoricoRH";

/**
 * Justificado × injustificado dos minutos que contam no percentual (STC-848),
 * pedido da coordenação para ver o peso dos atestados. Sem ausência que
 * conte, não aparece.
 */
function ComposicaoDasAusencias({
  colaboradorId,
  indicadores,
}: {
  colaboradorId: number;
  indicadores: Parameters<typeof composicaoDasAusencias>[0];
}) {
  const composicao = composicaoDasAusencias(indicadores);
  if (!composicao) return null;
  const titulo = `composicao-${colaboradorId}-titulo`;
  return (
    <section aria-labelledby={titulo} className="space-y-2">
      <h3 id={titulo} className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
        Ausências que contam no absenteísmo
      </h3>
      <div className="rounded-lg border border-border bg-card px-3.5 py-3">
        <ComposicaoComLegenda composicao={composicao} />
      </div>
    </section>
  );
}

function Indicador({
  rotulo,
  valor,
  detalhe = null,
  destaque = null,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string | null;
  destaque?: "critica" | "atencao" | null;
}) {
  return (
    <div className="bg-card px-3.5 py-2.5">
      <dt className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-semibold text-foreground tabular-nums",
          destaque === "critica" && "text-red-600",
          destaque === "atencao" && "text-amber-700",
        )}
      >
        {valor}
      </dd>
      {detalhe && <dd className="text-[11.5px] text-muted-foreground">{detalhe}</dd>}
    </div>
  );
}

interface CardAlertaProps {
  alerta: AlertaAbsenteismo;
  podeAgir: boolean;
  emFoco: boolean;
  onRegistrar: (alertaId: number, acao: AcaoTratamento, justificativa: string) => Promise<unknown>;
  onAbrirConversa?: (conversa: ConversaAberta, origem: HTMLElement) => void;
}

const CardAlerta = forwardRef<HTMLElement, CardAlertaProps>(function CardAlerta(
  { alerta, podeAgir, emFoco, onRegistrar, onAbrirConversa },
  ref,
) {
  const [registrando, setRegistrando] = useState(false);
  const tratamento = alerta.tratamento;
  // Sem tratamento e sem como registrar: uma importação seguinte tirou o
  // colaborador da faixa crítica e o alerta foi encerrado sozinho.
  const encerrado = !tratamento && !alerta.pode_registrar_tratamento;
  const gerado = formatarDataISO(alerta.gerado_em);
  const mostrarRegistrar =
    !encerrado && !tratamento && !registrando && podeAgir && alerta.pode_registrar_tratamento;
  const demandaId = alerta.demanda_id;
  const mostrarConversa = demandaId !== null && onAbrirConversa !== undefined;
  return (
    <section
      ref={ref}
      tabIndex={emFoco ? -1 : undefined}
      aria-labelledby={`alerta-${alerta.id}-titulo`}
      className={cn(
        "scroll-mt-4 space-y-3 rounded-lg border bg-card p-4 outline-none",
        tratamento || encerrado ? "border-border" : "border-red-600/30",
        emFoco && "ring-2 ring-secondary/60",
      )}
    >
      {/* No celular os selos vão para a linha de cima: ao lado, espremiam o
          título e o texto numa coluna estreita. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
          <h3 id={`alerta-${alerta.id}-titulo`} className="text-[14px] font-semibold text-foreground">
            {tituloAlerta(alerta)}
          </h3>
          <p className="text-[12.5px] text-muted-foreground">
            {alerta.demanda_aberta
              ? `Demanda aberta em ${gerado}${alerta.responsavel ? ` · responsável: ${alerta.responsavel}` : ""}`
              : `Gerado em ${gerado} · demanda concluída`}
            {/* Régua com que foi gerado: os indicadores acima usam a de hoje. */}
            {alerta.critica_acima_de != null &&
              ` · crítica acima de ${formatarPercentual(String(alerta.critica_acima_de))} quando gerado`}
            {!tratamento && podeAgir && alerta.pode_registrar_tratamento &&
              " · registre o tratamento para concluir"}
          </p>
        </div>
        <span className="order-first flex shrink-0 flex-wrap gap-1.5 sm:order-none sm:justify-end">
          {/* Pendência de ponto em aberto quando o alerta foi gerado: o
              percentual podia mudar depois da aprovação. */}
          {alerta.provisorio && (
            <span className="inline-flex rounded-full bg-amber-600/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 uppercase">
              Provisório
            </span>
          )}
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white uppercase",
              COR_FAIXA[alerta.faixa],
            )}
          >
            Faixa {ROTULO_FAIXA[alerta.faixa].toLowerCase()}
          </span>
        </span>
      </div>

      {encerrado ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-[12.5px] text-foreground">
          Encerrado: saiu da faixa crítica depois de uma nova importação. Não há tratamento a
          registrar.
        </p>
      ) : tratamento ? (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-[12.5px]">
          <p className="font-medium text-foreground">
            Tratamento: {ROTULO_ACAO_TRATAMENTO[tratamento.acao]}
          </p>
          <p className="mt-1 text-foreground">“{tratamento.justificativa}”</p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {formatarDataHora(tratamento.em)}
            {tratamento.por && ` · ${tratamento.por}`}
          </p>
        </div>
      ) : registrando ? (
        <FormRegistrarTratamento
          alertaId={alerta.id}
          onSalvar={async (acao, justificativa) => {
            await onRegistrar(alerta.id, acao, justificativa);
            setRegistrando(false);
          }}
          onCancelar={() => setRegistrando(false)}
        />
      ) : null}

      {(mostrarRegistrar || mostrarConversa) && (
        <div className="flex flex-wrap items-center gap-2">
          {mostrarRegistrar && (
            <Button type="button" size="sm" onClick={() => setRegistrando(true)}>
              Registrar tratamento
            </Button>
          )}
          {/* Conversa entre o RH (Admin) e a coordenação na demanda do
              alerta (STC-722) e os anexos dela (STC-850), abertos sobre a
              área do modal. */}
          {mostrarConversa && demandaId !== null && (
            <>
              <BotaoConversa
                demandaId={demandaId}
                onAbrir={(origem) =>
                  onAbrirConversa?.(
                    {
                      demandaId,
                      titulo: tituloAlerta(alerta),
                      aberta: alerta.demanda_aberta,
                      conteudo: "conversa",
                    },
                    origem,
                  )
                }
              />
              <BotaoAnexos
                demandaId={demandaId}
                onAbrir={(origem) =>
                  onAbrirConversa?.(
                    {
                      demandaId,
                      titulo: tituloAlerta(alerta),
                      aberta: alerta.demanda_aberta,
                      conteudo: "anexos",
                    },
                    origem,
                  )
                }
              />
            </>
          )}
        </div>
      )}
    </section>
  );
});

interface AbaAbsenteismoProps {
  /** Abre a conversa da demanda do alerta (painel do modal). */
  onAbrirConversa?: (conversa: ConversaAberta, origem: HTMLElement) => void;
  colaboradorId: number;
  ativo: boolean;
  /** Período inicial: o do painel ou o do alerta (card do Kanban). */
  periodoInicial: Periodo;
  /** Aberto pelo card do Kanban: rola até o alerta do período inicial. */
  focarAlerta: boolean;
}

export function AbaAbsenteismo({
  colaboradorId,
  ativo,
  periodoInicial,
  focarAlerta,
  onAbrirConversa,
}: AbaAbsenteismoProps) {
  const { periodo, editado, valido, editar } = usePeriodoEditavel(periodoInicial);
  const { aba, isLoading, trocandoPeriodo, mensagemErro, recarregar, registrarTratamento } =
    useAbsenteismoColaborador(colaboradorId, periodo);
  const refsAlertas = useRef(new Map<number, HTMLElement>());
  const focou = useRef(false);

  const alertaEmFoco = focarAlerta
    ? aba?.alertas.find(
        (alerta) =>
          alerta.periodo_inicio === periodoInicial.inicio && alerta.periodo_fim === periodoInicial.fim,
      )
    : undefined;

  // Aberto pelo card do Kanban: rola até o alerta e leva o foco a ele, uma vez.
  useEffect(() => {
    if (!alertaEmFoco || focou.current) return;
    const alvo = refsAlertas.current.get(alertaEmFoco.id);
    if (!alvo) return;
    focou.current = true;
    alvo.scrollIntoView?.({ block: "start", behavior: "smooth" });
    alvo.focus({ preventScroll: true });
  }, [alertaEmFoco]);

  const cabecalho = (
    <CampoPeriodo id={`absenteismo-${colaboradorId}`} editado={editado} valido={valido} onEditar={editar} />
  );

  if (isLoading && !aba) {
    return (
      <div className="space-y-3">
        {cabecalho}
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!aba) {
    return (
      <div className="space-y-3">
        {cabecalho}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">
            {mensagemErro ?? "Não foi possível carregar o absenteísmo do colaborador."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={recarregar}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const { indicadores, parametros } = aba;

  return (
    <div className={cn("space-y-4 transition-opacity", trocandoPeriodo && "opacity-60")} aria-busy={trocandoPeriodo || undefined}>
      {cabecalho}

      {/* Falha ao trocar de período: os dados abaixo continuam sendo os do
          último período que carregou, e isso precisa ficar dito. */}
      {mensagemErro && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive"
        >
          Não foi possível carregar o período escolhido. Os dados abaixo são de{" "}
          {formatarDataISO(aba.periodo.inicio)} a {formatarDataISO(aba.periodo.fim)}.
          <Button type="button" variant="outline" size="sm" onClick={recarregar}>
            Tentar novamente
          </Button>
        </div>
      )}

      {indicadores.pendencias > 0 && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-md border border-amber-600/25 bg-amber-600/5 p-3 text-[12.5px] text-foreground"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
          <span>
            {indicadores.pendencias}{" "}
            {indicadores.pendencias === 1
              ? "justificativa pendente no VR"
              : "justificativas pendentes no VR"}
            , aguardando aprovação no SuperApp. O percentual pode mudar depois da aprovação.
          </span>
        </div>
      )}

      {/* Faixa compacta, não os cards dos painéis: no modal, o que a
          coordenação veio ver são as ocorrências e o alerta. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        <Indicador
          rotulo="Absenteísmo"
          valor={formatarPercentual(indicadores.percentual)}
          detalhe={
            [
              indicadores.faixa && `faixa ${ROTULO_FAIXA[indicadores.faixa].toLowerCase()}`,
              indicadores.provisorio && "provisório",
            ]
              .filter(Boolean)
              .join(" · ") || null
          }
          destaque={indicadores.faixa}
        />
        <Indicador
          rotulo="Dias trabalhados"
          valor={
            indicadores.dias_previstos === 0
              ? "—"
              : `${indicadores.dias_trabalhados} de ${indicadores.dias_previstos}`
          }
        />
        <Indicador
          rotulo="Conformidade"
          valor={formatarPercentual(indicadores.conformidade_percentual)}
          detalhe="da jornada prevista"
        />
        <Indicador
          rotulo="Banco de horas"
          valor={formatarSaldoHoras(indicadores.banco_horas_saldo_minutos)}
          detalhe="saldo no fim do período"
          destaque={indicadores.banco_horas_saldo_minutos < 0 ? "critica" : null}
        />
      </dl>

      <ComposicaoDasAusencias colaboradorId={colaboradorId} indicadores={indicadores} />

      <section aria-labelledby={`ocorrencias-${colaboradorId}-titulo`} className="space-y-2">
        <h3
          id={`ocorrencias-${colaboradorId}-titulo`}
          className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase"
        >
          Ocorrências do período
        </h3>
        {aba.ocorrencias.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">Nenhuma ocorrência no período.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border bg-card">
            {aba.ocorrencias.map((ocorrencia, indice) => {
              const { datas, descricao, marcas } = textoOcorrencia(ocorrencia, parametros.limite_atraso_minutos);
              return (
                <li
                  key={`${ocorrencia.tipo}-${ocorrencia.inicio}-${indice}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3.5 py-2 text-[12.5px]"
                >
                  <span className="text-foreground">
                    <span className="text-muted-foreground tabular-nums">{datas}</span> · {descricao}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {marcas.map((marca) => (
                      <span
                        key={marca}
                        className={cn(
                          "rounded-full px-2 py-px text-[11px] font-medium",
                          marca === "conta no absenteísmo" && "bg-red-600/10 text-red-700",
                          marca === "pendente no VR" && "bg-amber-600/10 text-amber-800",
                          marca !== "conta no absenteísmo" && marca !== "pendente no VR" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {marca}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11.5px] text-muted-foreground">
          Atestados aparecem só com tipo e período, sem dados clínicos.
        </p>
      </section>

      {aba.alertas.map((alerta) => (
        <CardAlerta
          key={alerta.id}
          ref={(elemento) => {
            if (elemento) refsAlertas.current.set(alerta.id, elemento);
            else refsAlertas.current.delete(alerta.id);
          }}
          alerta={alerta}
          podeAgir={ativo}
          emFoco={alerta.id === alertaEmFoco?.id}
          onRegistrar={(alertaId, acao, justificativa) =>
            registrarTratamento({ alerta: alertaId, acao, justificativa })
          }
          onAbrirConversa={onAbrirConversa}
        />
      ))}

      <HistoricoRH id={`historico-absenteismo-${colaboradorId}`} registros={aba.historico} />
    </div>
  );
}
