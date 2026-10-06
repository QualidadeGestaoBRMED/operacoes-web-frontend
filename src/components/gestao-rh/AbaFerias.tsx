"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, History as HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeriasColaborador } from "@/hooks/useFeriasGestaoRH";
import { formatarDataISO } from "@/lib/gestaoRH";
import { intervalo, textoHistorico } from "@/lib/gestaoRHFerias";
import { cn, formatarDataHora } from "@/lib/utils";
import type { FeriasColaborador, RegistroHistoricoRH } from "@/types/gestaoRH";
import { CardPeriodoFerias, type AcaoAberta } from "./CardPeriodoFerias";

function AvisoVariosPeriodos({ ferias }: { ferias: FeriasColaborador }) {
  const pendentes = ferias.periodos_pendentes;
  if (pendentes.length < 2) return null;
  const maisAntigoVencido = pendentes[0].limite_vencido_ha_dias !== null;
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-2.5 rounded-md border p-3 text-[12.5px] text-foreground",
        maisAntigoVencido ? "border-red-600/25 bg-red-600/5" : "border-amber-600/25 bg-amber-600/5",
      )}
    >
      <AlertTriangle
        aria-hidden
        className={cn("mt-0.5 size-3.5 shrink-0", maisAntigoVencido ? "text-red-600" : "text-amber-700")}
      />
      <span>
        {pendentes.length} períodos com férias pendentes.
        {maisAntigoVencido &&
          " O mais antigo já passou do limite: as férias desse período devem ser pagas em dobro."}{" "}
        Programe primeiro o período mais antigo.
      </span>
    </div>
  );
}

function FeriasTiradas({ ferias }: { ferias: FeriasColaborador }) {
  const [aberto, setAberto] = useState(false);
  const tiradas = ferias.ferias_tiradas;
  if (tiradas.length === 0) return null;
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[13px] font-medium text-foreground"
      >
        Férias já tiradas ({tiradas.length})
        <ChevronDown
          aria-hidden
          className={cn("size-4 text-muted-foreground transition-transform", aberto && "rotate-180")}
        />
      </button>
      {aberto && (
        <ul className="space-y-1 border-t border-border px-4 py-2.5 text-[12.5px] text-muted-foreground">
          {tiradas.map((periodo) => (
            <li key={periodo.id}>
              Período {intervalo(periodo.inicio_aquisitivo, periodo.fim_aquisitivo)}
              {periodo.programacao &&
                `, tiradas de ${intervalo(periodo.programacao.data_inicio, periodo.programacao.data_fim)}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemHistorico({ registro }: { registro: RegistroHistoricoRH }) {
  return (
    <li className="flex gap-3 pb-3.5 last:pb-0">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-secondary/50 bg-secondary/10 text-secondary">
        <HistoryIcon aria-hidden className="size-3" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5 text-[12.5px]">
        <p className="text-foreground">{textoHistorico(registro)}</p>
        {registro.justificativa && (
          <p className="mt-0.5 text-muted-foreground">“{registro.justificativa}”</p>
        )}
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {formatarDataHora(registro.em)} · {registro.automatico ? "automático" : registro.por}
        </p>
      </div>
    </li>
  );
}

interface AbaFeriasProps {
  colaboradorId: number;
  ativo: boolean;
  periodoEmFoco: number | null;
  hoje: string;
}

export function AbaFerias({ colaboradorId, ativo, periodoEmFoco, hoje }: AbaFeriasProps) {
  const { ferias, isLoading, mensagemErro, recarregar, programar, adiar, registrarRhAcionado } =
    useFeriasColaborador(colaboradorId);
  const [acaoAberta, setAcaoAberta] = useState<AcaoAberta>(null);
  const refsPeriodos = useRef(new Map<number, HTMLElement>());
  const rolouPara = useRef<number | null>(null);

  // Aberto pelo card do Kanban: rola até o período do alerta, uma vez por período.
  useEffect(() => {
    if (!ferias || periodoEmFoco === null || rolouPara.current === periodoEmFoco) return;
    const alvo = refsPeriodos.current.get(periodoEmFoco);
    if (!alvo) return;
    rolouPara.current = periodoEmFoco;
    alvo.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, [ferias, periodoEmFoco]);

  if (isLoading && !ferias) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!ferias) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-destructive">
          {mensagemErro ?? "Não foi possível carregar as férias do colaborador."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={recarregar}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const emAndamento = ferias.periodo_em_andamento;

  return (
    <div className="space-y-4">
      <AvisoVariosPeriodos ferias={ferias} />

      {ferias.periodos_pendentes.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum período com férias pendentes.</p>
      )}

      {ferias.periodos_pendentes.map((periodo) => (
        <CardPeriodoFerias
          key={periodo.id}
          ref={(elemento) => {
            if (elemento) refsPeriodos.current.set(periodo.id, elemento);
            else refsPeriodos.current.delete(periodo.id);
          }}
          periodo={periodo}
          hoje={hoje}
          podeAgir={ativo}
          emFoco={periodo.id === periodoEmFoco}
          acaoAberta={acaoAberta}
          onAbrirAcao={setAcaoAberta}
          onProgramar={programar}
          onAdiar={adiar}
          onRhAcionado={registrarRhAcionado}
        />
      ))}

      {emAndamento && (
        <p className="text-[12.5px] text-muted-foreground">
          Próximo direito a partir de {formatarDataISO(emAndamento.direito_a_partir_de)} (período{" "}
          {intervalo(emAndamento.inicio_aquisitivo, emAndamento.fim_aquisitivo)}, em andamento).
        </p>
      )}

      <FeriasTiradas ferias={ferias} />

      <section aria-labelledby="historico-ferias-titulo" className="space-y-3 pt-2">
        <h3
          id="historico-ferias-titulo"
          className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase"
        >
          Histórico
        </h3>
        {ferias.historico.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <ul>
            {ferias.historico.map((registro, indice) => (
              <ItemHistorico key={`${registro.em}-${indice}`} registro={registro} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
