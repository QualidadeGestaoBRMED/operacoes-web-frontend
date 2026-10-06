"use client";

import { forwardRef, useState } from "react";
import { CalendarCheck2, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { extrairMensagemErro } from "@/lib/erros";
import { formatarDataISO } from "@/lib/gestaoRH";
import {
  COR_STATUS_PERIODO,
  ROTULO_MARCO_DO_PERIODO,
  ROTULO_STATUS_PERIODO,
  intervalo,
  textoDias,
  textoSituacaoMarco,
} from "@/lib/gestaoRHFerias";
import { cn, formatarDataHora } from "@/lib/utils";
import type { MarcoDoPeriodo, PeriodoPendente, ProgramarFeriasPayload } from "@/types/gestaoRH";
import { FormAdiarProgramacao } from "./FormAdiarProgramacao";
import { FormProgramarFerias } from "./FormProgramarFerias";

export type AcaoAberta = { periodoId: number; tipo: "programar" | "adiar" } | null;

const COR_PONTO_MARCO: Record<MarcoDoPeriodo["situacao"], string> = {
  alerta_gerado: "bg-amber-600",
  tratado: "bg-green-600",
  proximo: "bg-cyan-700",
  futuro: "bg-muted-foreground/40",
  sem_alerta: "bg-muted-foreground/40",
  vencido: "bg-red-600",
};

function LinhaMarco({
  marco,
  hoje,
  status,
}: {
  marco: MarcoDoPeriodo;
  hoje: string;
  status: PeriodoPendente["status"];
}) {
  const programado = status === "programado";
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-2.5 py-1.5 text-[13px]">
      <span aria-hidden className={cn("size-2 translate-y-[-1px] rounded-full", programado && marco.situacao === "proximo" ? COR_PONTO_MARCO.futuro : COR_PONTO_MARCO[marco.situacao])} />
      <span className="min-w-0">
        <span className="font-medium text-foreground">{ROTULO_MARCO_DO_PERIODO[marco.tipo]}</span>
        <span
          className={cn(
            "block text-[12px] text-muted-foreground",
            marco.situacao === "vencido" && "font-semibold text-red-600",
            marco.situacao === "proximo" && !programado && "text-cyan-700",
          )}
        >
          {textoSituacaoMarco(marco, hoje, status)}
        </span>
      </span>
      <span className="text-[12.5px] font-medium text-foreground tabular-nums">
        {formatarDataISO(marco.data)}
      </span>
    </li>
  );
}

interface CardPeriodoFeriasProps {
  periodo: PeriodoPendente;
  hoje: string;
  podeAgir: boolean;
  emFoco: boolean;
  acaoAberta: AcaoAberta;
  onAbrirAcao: (acao: AcaoAberta) => void;
  onProgramar: (periodoId: number, payload: ProgramarFeriasPayload) => Promise<unknown>;
  onAdiar: (periodoId: number, justificativa: string) => Promise<unknown>;
  onRhAcionado: (periodoId: number) => Promise<unknown>;
}

export const CardPeriodoFerias = forwardRef<HTMLElement, CardPeriodoFeriasProps>(
  function CardPeriodoFerias(
    { periodo, hoje, podeAgir, emFoco, acaoAberta, onAbrirAcao, onProgramar, onAdiar, onRhAcionado },
    ref,
  ) {
    const [confirmandoRh, setConfirmandoRh] = useState(false);
    const [registrandoRh, setRegistrandoRh] = useState(false);
    const vencido = periodo.limite_vencido_ha_dias !== null;
    const programacao = periodo.status === "programado" ? periodo.programacao : null;
    const acaoDestePeriodo = acaoAberta?.periodoId === periodo.id ? acaoAberta.tipo : null;
    const prazoRhPassou =
      !!programacao?.data_limite_substituicao && programacao.data_limite_substituicao < hoje;

    async function confirmarRh() {
      setRegistrandoRh(true);
      try {
        await onRhAcionado(periodo.id);
        toast.success("Registrado: RH acionado.");
        setConfirmandoRh(false);
      } catch (falha) {
        toast.error(extrairMensagemErro(falha));
      } finally {
        setRegistrandoRh(false);
      }
    }

    return (
      <section
        ref={ref}
        aria-labelledby={`periodo-${periodo.id}-titulo`}
        className={cn(
          "scroll-mt-4 space-y-3 rounded-lg border border-border bg-card p-4",
          vencido && "border-red-600/30",
          emFoco && "ring-2 ring-secondary/60",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 id={`periodo-${periodo.id}-titulo`} className="text-[14px] font-semibold text-foreground">
              Período {intervalo(periodo.inicio_aquisitivo, periodo.fim_aquisitivo)}
            </h3>
            <p className="text-[12.5px] text-muted-foreground">
              Direito adquirido em {formatarDataISO(periodo.direito_adquirido_em)} · limite para
              tirar: {formatarDataISO(periodo.limite_concessivo)}
              {vencido && <span className="font-semibold text-red-600"> (vencido)</span>}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase",
              COR_STATUS_PERIODO[periodo.status],
            )}
          >
            {ROTULO_STATUS_PERIODO[periodo.status]}
          </span>
        </div>

        <ul aria-label="Marcos do período" className="divide-y divide-border/60">
          {periodo.marcos.map((marco) => (
            <LinhaMarco key={marco.tipo} marco={marco} hoje={hoje} status={periodo.status} />
          ))}
        </ul>

        {periodo.adiamento && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-[12.5px]">
            <p className="text-muted-foreground">
              Adiada
              {periodo.adiamento.em && ` em ${formatarDataISO(periodo.adiamento.em)}`}
              {periodo.adiamento.por && ` por ${periodo.adiamento.por}`}
            </p>
            <p className="mt-1 text-foreground">“{periodo.adiamento.justificativa}”</p>
          </div>
        )}

        {programacao && (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-[12.5px]">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <CalendarCheck2 aria-hidden className="size-3.5 text-cyan-700" />
              Férias de {intervalo(programacao.data_inicio, programacao.data_fim)} (
              {textoDias(programacao.dias)}) ·{" "}
              {programacao.necessita_substituicao ? "com substituição" : "sem substituição"}
            </p>
            {programacao.necessita_substituicao &&
              (programacao.rh_acionado_em ? (
                <p className="flex items-center gap-2 text-green-700">
                  <UserRoundCog aria-hidden className="size-3.5" />
                  RH acionado em {formatarDataHora(programacao.rh_acionado_em)}
                  {programacao.rh_acionado_por && ` por ${programacao.rh_acionado_por}`}
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    className={cn(
                      "flex items-center gap-2",
                      prazoRhPassou ? "font-semibold text-red-600" : "text-amber-700",
                    )}
                  >
                    <UserRoundCog aria-hidden className="size-3.5" />
                    {programacao.data_limite_substituicao
                      ? `Acionar o RH até ${formatarDataISO(programacao.data_limite_substituicao)}`
                      : "Acionar o RH"}
                    {prazoRhPassou && " (prazo passou)"}
                  </p>
                  {podeAgir && periodo.pode_registrar_rh_acionado && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfirmandoRh(true)}>
                      RH acionado
                    </Button>
                  )}
                </div>
              ))}
          </div>
        )}

        {acaoDestePeriodo === "programar" ? (
          <FormProgramarFerias
            periodo={periodo}
            hoje={hoje}
            onSalvar={async (payload) => {
              await onProgramar(periodo.id, payload);
              onAbrirAcao(null);
            }}
            onCancelar={() => onAbrirAcao(null)}
          />
        ) : acaoDestePeriodo === "adiar" ? (
          <FormAdiarProgramacao
            periodoId={periodo.id}
            onSalvar={async (justificativa) => {
              await onAdiar(periodo.id, justificativa);
              onAbrirAcao(null);
            }}
            onCancelar={() => onAbrirAcao(null)}
          />
        ) : (
          podeAgir &&
          (periodo.pode_programar || periodo.pode_adiar) && (
            <div className="flex flex-wrap gap-2">
              {periodo.pode_programar && (
                <Button
                  type="button"
                  size="sm"
                  disabled={acaoAberta !== null}
                  onClick={() => onAbrirAcao({ periodoId: periodo.id, tipo: "programar" })}
                >
                  {programacao ? "Reprogramar férias" : "Programar férias"}
                </Button>
              )}
              {periodo.pode_adiar && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={acaoAberta !== null}
                  onClick={() => onAbrirAcao({ periodoId: periodo.id, tipo: "adiar" })}
                >
                  Não programar agora
                </Button>
              )}
            </div>
          )
        )}

        <ConfirmDialog
          open={confirmandoRh}
          onOpenChange={setConfirmandoRh}
          titulo="Registrar que o RH foi acionado?"
          descricao="Conclui a demanda de acionar o RH para a substituição. O registro fica no histórico e não pode ser desfeito."
          textoConfirmar="Registrar"
          isLoading={registrandoRh}
          onConfirmar={() => void confirmarRh()}
        />
      </section>
    );
  },
);
