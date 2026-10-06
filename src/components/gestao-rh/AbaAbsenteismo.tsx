"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarCheck, Clock, Info, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAbsenteismoColaborador } from "@/hooks/useAbsenteismoGestaoRH";
import { usePeriodoEditavel, type Periodo } from "@/hooks/usePeriodoEditavel";
import { formatarDataISO } from "@/lib/gestaoRH";
import {
  COR_FAIXA,
  ROTULO_ACAO_TRATAMENTO,
  ROTULO_FAIXA,
  formatarPercentual,
  formatarSaldoHoras,
  textoOcorrencia,
  tituloAlerta,
} from "@/lib/gestaoRHAbsenteismo";
import { cn, formatarDataHora } from "@/lib/utils";
import type { AcaoTratamento, AlertaAbsenteismo } from "@/types/gestaoRH";
import { CampoPeriodo } from "./CampoPeriodo";
import { CardIndicador, type CorCard } from "./CardIndicador";
import { FormRegistrarTratamento } from "./FormRegistrarTratamento";
import { HistoricoRH } from "./HistoricoRH";

interface CardAlertaProps {
  alerta: AlertaAbsenteismo;
  podeAgir: boolean;
  emFoco: boolean;
  onRegistrar: (alertaId: number, acao: AcaoTratamento, justificativa: string) => Promise<unknown>;
}

const CardAlerta = forwardRef<HTMLElement, CardAlertaProps>(function CardAlerta(
  { alerta, podeAgir, emFoco, onRegistrar },
  ref,
) {
  const [registrando, setRegistrando] = useState(false);
  const tratamento = alerta.tratamento;
  return (
    <section
      ref={ref}
      tabIndex={emFoco ? -1 : undefined}
      aria-labelledby={`alerta-${alerta.id}-titulo`}
      className={cn(
        "scroll-mt-4 space-y-3 rounded-lg border bg-card p-4 outline-none",
        tratamento ? "border-border" : "border-red-600/30",
        emFoco && "ring-2 ring-secondary/60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`alerta-${alerta.id}-titulo`} className="text-[14px] font-semibold text-foreground">
            {tituloAlerta(alerta)}
          </h3>
          <p className="text-[12.5px] text-muted-foreground">
            {alerta.demanda_aberta
              ? `Demanda aberta${alerta.responsavel ? ` para a ${alerta.responsavel}` : ""} em ${formatarDataISO(alerta.gerado_em)}`
              : `Gerado em ${formatarDataISO(alerta.gerado_em)} · demanda concluída`}
            {!tratamento && podeAgir && alerta.pode_registrar_tratamento &&
              " · registre o tratamento para concluir"}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white uppercase",
            COR_FAIXA[alerta.faixa],
          )}
        >
          Faixa {ROTULO_FAIXA[alerta.faixa].toLowerCase()}
        </span>
      </div>

      {tratamento ? (
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
      ) : (
        podeAgir &&
        alerta.pode_registrar_tratamento && (
          <Button type="button" size="sm" onClick={() => setRegistrando(true)}>
            Registrar tratamento
          </Button>
        )
      )}
    </section>
  );
});

interface AbaAbsenteismoProps {
  colaboradorId: number;
  ativo: boolean;
  /** Período inicial: o do painel ou o do alerta (card do Kanban). */
  periodoInicial: Periodo;
  /** Aberto pelo card do Kanban: rola até o alerta do período inicial. */
  focarAlerta: boolean;
}

export function AbaAbsenteismo({ colaboradorId, ativo, periodoInicial, focarAlerta }: AbaAbsenteismoProps) {
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
  const corAbsenteismo: CorCard =
    indicadores.faixa === "critica" ? "vencido" : indicadores.faixa === "atencao" ? "atencao" : "andamento";

  return (
    <div className={cn("space-y-4 transition-opacity", trocandoPeriodo && "opacity-60")} aria-busy={trocandoPeriodo || undefined}>
      {cabecalho}

      {indicadores.pendencias > 0 && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-md border border-amber-600/25 bg-amber-600/5 p-3 text-[12.5px] text-foreground"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
          <span>
            {indicadores.pendencias}{" "}
            {indicadores.pendencias === 1
              ? "pendência de ponto aguardando aprovação"
              : "pendências de ponto aguardando aprovação"}{" "}
            no SuperApp VR. O percentual pode mudar depois da aprovação.
          </span>
        </div>
      )}

      {/* 2×2: na largura do modal, quatro lado a lado cortam os títulos. */}
      <div className="grid grid-cols-2 gap-3">
        <CardIndicador
          rotulo="Absenteísmo"
          valor={formatarPercentual(indicadores.percentual)}
          legenda={
            [indicadores.faixa && `faixa ${ROTULO_FAIXA[indicadores.faixa].toLowerCase()}`, indicadores.provisorio && "provisório"]
              .filter(Boolean)
              .join(" · ") || "no período selecionado"
          }
          cor={corAbsenteismo}
          Icone={Percent}
        />
        <CardIndicador
          rotulo="Dias trabalhados"
          valor={indicadores.dias_previstos === 0 ? "—" : `${indicadores.dias_trabalhados} de ${indicadores.dias_previstos}`}
          legenda="no período selecionado"
          cor="neutro"
          Icone={CalendarCheck}
        />
        <CardIndicador
          rotulo="Conformidade"
          valor={formatarPercentual(indicadores.conformidade_percentual)}
          legenda="da jornada prevista"
          cor="neutro"
          Icone={Info}
        />
        <CardIndicador
          rotulo="Banco de horas"
          valor={formatarSaldoHoras(indicadores.banco_horas_saldo_minutos)}
          legenda="saldo no fim do período"
          cor={indicadores.banco_horas_saldo_minutos < 0 ? "vencido" : "neutro"}
          Icone={Clock}
        />
      </div>

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
                          marca === "em aprovação" && "bg-amber-600/10 text-amber-800",
                          marca !== "conta no absenteísmo" && marca !== "em aprovação" && "bg-muted text-muted-foreground",
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
        />
      ))}

      <HistoricoRH id={`historico-absenteismo-${colaboradorId}`} registros={aba.historico} />
    </div>
  );
}
