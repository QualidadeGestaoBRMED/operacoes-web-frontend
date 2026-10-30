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
import { PainelConversa, type ConversaAberta } from "./ConversaDoAlerta";

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
  // O diálogo anima a saída por ~0,2 s depois de fechar: até ela terminar
  // (onCloseAutoFocus), o modal segue com o colaborador que estava aberto.
  // Sem isso, a saída mostrava o carregamento no lugar dos dados (STC-960).
  const [idExibido, setIdExibido] = useState(colaboradorId);
  if (colaboradorId !== null && colaboradorId !== idExibido) {
    setIdExibido(colaboradorId);
  }
  const { colaborador, isLoading, mensagemErro, recarregar } = useColaboradorRH(idExibido);
  const alertasFerias = colaborador?.alertas_pendentes.ferias ?? 0;
  const alertasAbsenteismo = colaborador?.alertas_pendentes.absenteismo ?? 0;
  // Conversa da demanda de um alerta, sobre a área de conteúdo. O modal
  // continua montado depois de fechar (só fica sem colaborador): qualquer
  // mudança de colaborador, inclusive fechar, fecha a conversa, para reabrir
  // o mesmo colaborador sempre na aba.
  const [conversa, setConversa] = useState<{ dados: ConversaAberta; origem: HTMLElement } | null>(
    null,
  );
  const [colaboradorDaConversa, setColaboradorDaConversa] = useState(idExibido);
  if (colaboradorDaConversa !== idExibido) {
    setColaboradorDaConversa(idExibido);
    setConversa(null);
  }
  const conversaAberta = conversa;

  function abrirConversa(dados: ConversaAberta, origem: HTMLElement) {
    setConversa({ dados, origem });
  }

  function voltarDaConversa() {
    const origem = conversaAberta?.origem;
    setConversa(null);
    // Devolve o foco ao botão que abriu, depois que a aba volta a aceitar foco.
    requestAnimationFrame(() => origem?.focus());
  }

  return (
    <Dialog open={colaboradorId !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent
        onCloseAutoFocus={() => setIdExibido(null)}
        // Com a conversa aberta, Esc volta à aba (sem perder o modal nem o
        // contexto); com a aba na tela, fecha o modal como sempre.
        onEscapeKeyDown={(evento) => {
          if (conversaAberta) {
            evento.preventDefault();
            voltarDaConversa();
          }
        }}
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
                {[colaborador.cargo, colaborador.unidade?.nome ?? colaborador.equipe]
                  .filter(Boolean)
                  .join(" · ")}
              </DialogDescription>
              {/* No celular a coluna de dados some e o que só ela mostrava vem
                  para esta linha, para as abas ganharem a altura do modal. */}
              <p className="text-[12.5px] text-muted-foreground sm:hidden">
                Matrícula {colaborador.matricula_vr || "não informada"} · Admissão{" "}
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
                {/* Sem unidade do Atlas (Operações Especiais ainda não ligada): vale a equipe do VR. */}
                {!colaborador.unidade && colaborador.equipe ? (
                  <CampoMeta rotulo="Equipe">{colaborador.equipe}</CampoMeta>
                ) : (
                  <CampoMeta rotulo="Unidade">{colaborador.unidade?.nome ?? "Sem unidade"}</CampoMeta>
                )}
                {colaborador.cargo && <CampoMeta rotulo="Cargo">{colaborador.cargo}</CampoMeta>}
                {/* Os relatórios do VR não trazem matrícula. */}
                <CampoMeta rotulo="Matrícula">{colaborador.matricula_vr || "Não informada"}</CampoMeta>
                <CampoMeta rotulo="Admissão">
                  {colaborador.data_admissao ? formatarDataISO(colaborador.data_admissao) : "Não informada"}
                </CampoMeta>
              </div>

              {/* A aba continua montada sob a conversa (período e rolagem
                  ficam como estavam); inert tira ela do foco enquanto isso. */}
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <div inert={conversaAberta !== null} className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                    onAbrirConversa={abrirConversa}
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
                          onAbrirConversa={abrirConversa}
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
              {conversaAberta && (
                <PainelConversa conversa={conversaAberta.dados} onVoltar={voltarDaConversa} />
              )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
