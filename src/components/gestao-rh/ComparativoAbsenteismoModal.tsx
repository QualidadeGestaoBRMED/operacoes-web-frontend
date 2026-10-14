"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarDataISO } from "@/lib/gestaoRH";
import {
  corDaDiferenca,
  diferencaEmPontos,
  formatarDiferenca,
  formatarPercentual,
  nomeDoPeriodo,
  periodoEmAndamento,
} from "@/lib/gestaoRHAbsenteismo";
import { cn } from "@/lib/utils";
import type { PainelAbsenteismo } from "@/types/gestaoRH";

interface ComparativoAbsenteismoModalProps {
  aberto: boolean;
  onFechar: () => void;
  atual: PainelAbsenteismo;
  /** Indefinido enquanto carrega ou quando a busca falhou. */
  anterior: PainelAbsenteismo | undefined;
  mensagemErroAnterior: string | null;
  onRecarregarAnterior: () => void;
  /** "Todas as unidades", o nome da unidade filtrada, com a categoria se houver. */
  visao: string;
  hoje: string;
}

function Selo({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full bg-amber-600/10 px-2 py-px text-[10.5px] font-bold text-amber-800 uppercase">
      {children}
    </span>
  );
}

function ColunaPeriodo({
  titulo,
  painel,
  hoje,
}: {
  titulo: string;
  painel: PainelAbsenteismo;
  hoje: string;
}) {
  const { cards, periodo, parametros } = painel;
  const parcial = periodoEmAndamento(periodo, hoje);
  const provisorio = cards.colaboradores_provisorios > 0;
  return (
    <div className="min-w-0 rounded-lg border border-border p-4">
      <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {titulo}
      </div>
      <div className="mt-0.5 text-[12.5px] text-muted-foreground">
        {formatarDataISO(periodo.inicio)} a {formatarDataISO(periodo.fim)}
      </div>
      {(parcial || provisorio) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {parcial && <Selo>Parcial</Selo>}
          {provisorio && <Selo>Provisório</Selo>}
        </div>
      )}
      <dl className="mt-3 space-y-2 text-[13px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Absenteísmo</dt>
          <dd className="text-xl font-bold text-foreground">
            {formatarPercentual(cards.percentual_periodo)}
          </dd>
        </div>
        {/* As faixas vêm da versão dos parâmetros vigente no fim de cada
            período: sem faixas cadastradas naquela versão, ninguém é classificado. */}
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Faixa crítica</dt>
          <dd className="font-semibold text-red-600">
            {parametros.faixas_cadastradas ? cards.faixa_critica : "—"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Faixa de atenção</dt>
          <dd className="font-semibold text-amber-700">
            {parametros.faixas_cadastradas ? cards.faixa_atencao : "—"}
          </dd>
        </div>
      </dl>
      {!parametros.faixas_cadastradas && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">Sem faixas cadastradas neste período.</p>
      )}
    </div>
  );
}

export function ComparativoAbsenteismoModal({
  aberto,
  onFechar,
  atual,
  anterior,
  mensagemErroAnterior,
  onRecarregarAnterior,
  visao,
  hoje,
}: ComparativoAbsenteismoModalProps) {
  const pontos = anterior
    ? diferencaEmPontos(atual.cards.percentual_periodo, anterior.cards.percentual_periodo)
    : null;

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Comparativo com o período anterior</DialogTitle>
          <DialogDescription>{visao}</DialogDescription>
        </DialogHeader>

        {anterior && (
          <p className="text-[13px] text-foreground">
            {pontos === null ? (
              "Sem percentual em um dos períodos para comparar."
            ) : (
              <>
                <span className={cn("font-semibold", corDaDiferenca(pontos))}>
                  {formatarDiferenca(pontos)}
                </span>{" "}
                em relação a {nomeDoPeriodo(anterior.periodo, atual.periodo)}
              </>
            )}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {anterior ? (
            <ColunaPeriodo titulo="Período anterior" painel={anterior} hoje={hoje} />
          ) : mensagemErroAnterior ? (
            <div
              role="alert"
              className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-[12.5px] text-destructive"
            >
              Não foi possível carregar o período anterior.
              <Button type="button" variant="outline" size="sm" onClick={onRecarregarAnterior}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Skeleton className="h-[180px] rounded-lg" aria-label="Carregando o período anterior" />
          )}
          <ColunaPeriodo titulo="Período selecionado" painel={atual} hoje={hoje} />
        </div>

        <p className="text-[11.5px] text-muted-foreground">
          Os dois períodos consideram os colaboradores ativos hoje, com os mesmos filtros de unidade e
          categoria.
        </p>
      </DialogContent>
    </Dialog>
  );
}
