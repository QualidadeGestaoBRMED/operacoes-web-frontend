"use client";

import { useState } from "react";
import { CalendarDays, Percent } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FERIAS_ATIVA } from "@/config/gestaoRH";
import { useColaboradorRH } from "@/hooks/useFeriasGestaoRH";
import { formatarDataISO } from "@/lib/gestaoRH";
import { hojeISO } from "@/lib/utils";
import type { Periodo } from "@/hooks/usePeriodoEditavel";
import { mesAnteriorFechado } from "@/lib/gestaoRHAbsenteismo";
import { AbaAbsenteismo } from "./AbaAbsenteismo";
import { AbaFerias } from "./AbaFerias";

function CampoMeta({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </span>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

interface DetalheColaboradorModalProps {
  colaboradorId: number | null;
  periodoEmFoco: number | null;
  /** Aba em que o modal abre: a do painel (ou do card do Kanban) que o chamou. */
  abaInicial?: Aba;
  /** Período da aba Absenteísmo: o do painel ou o do alerta. Sem ele, o mês anterior fechado. */
  periodoAbsenteismo?: Periodo | null;
  /** Aberto pelo card de absenteísmo do Kanban: rola até o alerta do período. */
  focarAlertaAbsenteismo?: boolean;
  onFechar: () => void;
}

function SeloAlertas({ quantidade }: { quantidade: number }) {
  if (quantidade === 0) return null;
  return (
    <span className="rounded-full bg-amber-600/15 px-1.5 py-px text-[10.5px] font-bold text-amber-700">
      {quantidade} {quantidade === 1 ? "alerta" : "alertas"}
    </span>
  );
}

type Aba = "absenteismo" | "ferias";

/**
 * Cada aba só carrega quando é aberta pela primeira vez e, depois, fica
 * montada (escondida quando inativa): trocar de aba não descarta um
 * formulário preenchido nem o período escolhido.
 */
function AbasDoColaborador({
  abaInicial,
  children,
}: {
  abaInicial: Aba;
  children: (abaAtiva: Aba, visitadas: Set<Aba>, setAbaAtiva: (aba: Aba) => void) => React.ReactNode;
}) {
  const [abaAtiva, setAba] = useState<Aba>(abaInicial);
  const [visitadas, setVisitadas] = useState<Set<Aba>>(() => new Set([abaInicial]));
  function setAbaAtiva(aba: Aba) {
    setAba(aba);
    setVisitadas((atuais) => (atuais.has(aba) ? atuais : new Set([...atuais, aba])));
  }
  return <>{children(abaAtiva, visitadas, setAbaAtiva)}</>;
}

const CLASSE_ABA = "flex-none gap-1.5 rounded-none px-1 text-[13px] data-[state=active]:shadow-none";
const CLASSE_CONTEUDO = "scrollbar-discreta flex-1 overflow-y-auto p-5";

/**
 * Modal único do colaborador (Gestão RH), aberto pela URL. Cabeçalho e
 * dados do colaborador ficam na coluna da esquerda; cada pilar é uma aba
 * que só carrega quando aberta. Mesma estrutura do detalhe do documento da
 * Legalização.
 */
export function DetalheColaboradorModal({
  colaboradorId,
  periodoEmFoco,
  abaInicial = "ferias",
  periodoAbsenteismo = null,
  focarAlertaAbsenteismo = false,
  onFechar,
}: DetalheColaboradorModalProps) {
  const { colaborador, isLoading, mensagemErro, recarregar } = useColaboradorRH(colaboradorId);
  const alertasFerias = colaborador?.alertas_pendentes.ferias ?? 0;
  const alertasAbsenteismo = colaborador?.alertas_pendentes.absenteismo ?? 0;

  return (
    <Dialog open={colaboradorId !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent
        showCloseButton
        className="flex max-h-[88vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        {isLoading || (!colaborador && !mensagemErro) ? (
          <div className="flex flex-1 flex-col gap-4 p-6">
            <DialogTitle className="sr-only">Carregando colaborador</DialogTitle>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-4 h-64 w-full" />
          </div>
        ) : !colaborador ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-destructive">
            <DialogTitle className="sr-only">Colaborador</DialogTitle>
            Não foi possível carregar o colaborador: {mensagemErro}
            <Button type="button" variant="outline" size="sm" onClick={recarregar}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="gap-1.5 border-b border-border px-6 py-4">
              <DialogTitle className="text-[17px] leading-snug font-semibold text-foreground">
                {colaborador.nome}
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground">
                {[colaborador.cargo, colaborador.unidade.nome].filter(Boolean).join(" · ")}
              </DialogDescription>
              {/* No celular a coluna de dados some e o que só ela mostrava vem
                  para esta linha, para as abas ganharem a altura do modal. */}
              <p className="text-[12.5px] text-muted-foreground sm:hidden">
                Matrícula {colaborador.matricula_vr} · Admissão{" "}
                {colaborador.data_admissao
                  ? formatarDataISO(colaborador.data_admissao)
                  : "não informada"}
              </p>
              {!colaborador.ativo && (
                <span className="w-fit rounded-full bg-slate-500 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                  Desligado
                </span>
              )}
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:grid sm:grid-cols-[230px_1fr]">
              <div className="scrollbar-discreta hidden flex-col gap-4 overflow-y-auto border-r border-border p-4.5 sm:flex">
                <CampoMeta rotulo="Unidade">{colaborador.unidade.nome}</CampoMeta>
                {colaborador.cargo && <CampoMeta rotulo="Cargo">{colaborador.cargo}</CampoMeta>}
                <CampoMeta rotulo="Matrícula">{colaborador.matricula_vr}</CampoMeta>
                <CampoMeta rotulo="Admissão">
                  {colaborador.data_admissao ? formatarDataISO(colaborador.data_admissao) : "Não informada"}
                </CampoMeta>
              </div>

              {!FERIAS_ATIVA ? (
                // Sem férias, o absenteísmo é o único conteúdo: sem barra de
                // abas, inclusive quando um link antigo pede a aba Férias.
                <div className={CLASSE_CONTEUDO}>
                  <AbaAbsenteismo
                    key={colaborador.id}
                    colaboradorId={colaborador.id}
                    ativo={colaborador.ativo}
                    periodoInicial={periodoAbsenteismo ?? mesAnteriorFechado(hojeISO())}
                    focarAlerta={focarAlertaAbsenteismo}
                  />
                </div>
              ) : (
              /* Ordem do mockup: Absenteísmo, Férias. key: trocar de colaborador
                  com o modal aberto recomeça na aba de quem o chamou. */
              <AbasDoColaborador key={colaborador.id} abaInicial={abaInicial}>
                {(abaAtiva, visitadas, setAbaAtiva) => (
                  <Tabs
                    value={abaAtiva}
                    onValueChange={(valor) => setAbaAtiva(valor as Aba)}
                    className="min-h-0 min-w-0 flex-1 gap-0"
                  >
                    <TabsList
                      variant="line"
                      className="h-11 w-full justify-start gap-4 rounded-none border-b border-border bg-transparent px-5"
                    >
                      <TabsTrigger value="absenteismo" className={CLASSE_ABA}>
                        <Percent aria-hidden className="size-3.5" />
                        Absenteísmo
                        <SeloAlertas quantidade={alertasAbsenteismo} />
                      </TabsTrigger>
                      <TabsTrigger value="ferias" className={CLASSE_ABA}>
                        <CalendarDays aria-hidden className="size-3.5" />
                        Férias
                        <SeloAlertas quantidade={alertasFerias} />
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="absenteismo"
                      forceMount
                      hidden={abaAtiva !== "absenteismo"}
                      className={CLASSE_CONTEUDO}
                    >
                      {visitadas.has("absenteismo") && (
                        <AbaAbsenteismo
                          colaboradorId={colaborador.id}
                          ativo={colaborador.ativo}
                          periodoInicial={periodoAbsenteismo ?? mesAnteriorFechado(hojeISO())}
                          focarAlerta={focarAlertaAbsenteismo}
                        />
                      )}
                    </TabsContent>
                    <TabsContent
                      value="ferias"
                      forceMount
                      hidden={abaAtiva !== "ferias"}
                      className={CLASSE_CONTEUDO}
                    >
                      {visitadas.has("ferias") && (
                        <AbaFerias
                          colaboradorId={colaborador.id}
                          ativo={colaborador.ativo}
                          periodoEmFoco={periodoEmFoco}
                          hoje={hojeISO()}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </AbasDoColaborador>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
