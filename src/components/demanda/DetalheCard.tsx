"use client";

import { useEffect, useState } from "react";
import { Calendar, Lock, MessageSquare, Paperclip, Clock as ClockIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnexos } from "@/hooks/useAnexos";
import { useComentarios } from "@/hooks/useComentarios";
import { useDemanda } from "@/hooks/useDemandas";
import { useHistorico } from "@/hooks/useHistorico";
import { COR_PRIORIDADE, LABEL_PRIORIDADE, ROTULO_STATUS, diasAteOPrazo } from "@/lib/kanban";
import { cn, nomeExibicao } from "@/lib/utils";
import type { StatusDemanda } from "@/types";
import { AnexoList } from "./AnexoList";
import { ComentarioFeed } from "./ComentarioFeed";
import { EditarDemandaSection } from "./EditarDemandaSection";
import { HistoricoTimeline } from "./HistoricoTimeline";
import { ResponsavelSection } from "./ResponsavelSection";
import { TransicaoStatusSection } from "./TransicaoStatusSection";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[13px] font-medium text-foreground">
      {children}
    </span>
  );
}

function CampoMeta({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </span>
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {children}
      </div>
    </div>
  );
}

function formatarPrazo(dataPrevista: string) {
  const [ano, mes, dia] = dataPrevista.split("-");
  const diasRestantes = diasAteOPrazo(dataPrevista);
  return {
    texto: `${dia}/${mes}/${ano}`,
    atrasada: diasRestantes < 0,
    proxima: diasRestantes >= 0 && diasRestantes <= 3,
  };
}

export function DetalheCard({
  demandaId,
  onOpenChange,
  secaoInicial,
  statusAlvoInicial,
}: {
  demandaId: number | null;
  onOpenChange: (open: boolean) => void;
  // STC-203: quando o modal abre por causa de um drag-and-drop bloqueado,
  // já chega com a seção que resolve o bloqueio pré-expandida (e, no caso
  // de status, o destino já pré-selecionado) -- em vez de só o toast e o
  // usuário refazendo tudo manualmente. undefined no clique normal num
  // card (comportamento de sempre: nenhuma seção aberta).
  secaoInicial?: "status" | "responsavel";
  statusAlvoInicial?: StatusDemanda;
}) {
  const { demanda, isLoading, mensagemErro } = useDemanda(demandaId);
  // Chamados aqui só pra alimentar os contadores das abas (badge de
  // quantidade) -- a chave do SWR é a mesma usada dentro de ComentarioFeed/
  // AnexoList/HistoricoTimeline, então isso não gera fetch duplicado, só
  // reaproveita o cache.
  const { comentarios } = useComentarios(demandaId);
  const { anexos } = useAnexos(demandaId);
  const { historico } = useHistorico(demandaId);
  const podeEscrever = demanda ? demanda.status !== "lixeira" : false;
  // Fonte de verdade no backend: inclui admin/solicitante/responsavel e a
  // PermissaoUsuario temporaria "editar" vigente no escopo da demanda.
  // Replicar essa regra aqui faria a UI divergir em expiracao/revogacao.
  const podeEditar = demanda?.pode_editar ?? false;

  // Qual seção com formulário está aberta -- ResponsavelSection (adicionar/
  // trocar principal), TransicaoStatusSection (mudar status) e agora
  // EditarDemandaSection são independentes, mas só uma pode estar expandida
  // por vez (achado no review: sem isso, as seções ficavam abertas juntas,
  // empilhadas na coluna).
  const [secaoAberta, setSecaoAberta] = useState<"status" | "responsavel" | "editar" | null>(
    null,
  );

  // STC-203: toda vez que uma demanda é aberta (incluindo por um clique
  // normal, onde secaoInicial vem undefined), sincroniza a seção aberta a
  // partir do que foi pedido de fora -- sem isso, abrir uma demanda depois
  // de fechar outra com uma seção expandida deixava essa seção "grudada".
  useEffect(() => {
    if (demandaId !== null) setSecaoAberta(secaoInicial ?? null);
  }, [demandaId, secaoInicial]);

  return (
    <Dialog open={demandaId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex h-[85vh] max-h-[720px] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        {isLoading ? (
          <div className="flex flex-1 flex-col gap-4 p-6">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-4 h-full w-full" />
          </div>
        ) : mensagemErro || !demanda ? (
          // Achado no review: a ordem original ("isLoading || !demanda")
          // fazia esse branch de erro nunca ser alcançado -- demanda vem
          // undefined tanto durante o carregamento quanto após uma falha
          // real (404, RBAC, rede), então !demanda já era sempre true nessa
          // segunda situação e o skeleton ficava preso pra sempre, sem
          // mostrar mensagemErro. "!demanda" continua aqui só como guarda de
          // tipo pro TypeScript (SWR nunca deixa os dois falsy ao mesmo
          // tempo sem ser um desses dois casos).
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
            {mensagemErro ?? "Não foi possível carregar esta demanda."}
          </div>
        ) : (
          <>
            <DialogHeader className="gap-2.5 border-b border-border px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <DialogTitle className="text-[17px] leading-snug font-semibold text-foreground">
                  {demanda.titulo}
                </DialogTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase",
                    COR_PRIORIDADE[demanda.prioridade],
                  )}
                >
                  {LABEL_PRIORIDADE[demanda.prioridade]}
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                  {ROTULO_STATUS[demanda.status] ?? demanda.status}
                </span>
                {demanda.confidencial && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"
                    title="Demanda confidencial"
                  >
                    <Lock className="size-3.5" />
                    Confidencial
                  </span>
                )}
              </div>
            </DialogHeader>

            {/* Achado na auditoria de responsividade (STC-186): grid fixo
                270px+1fr sem variante mobile deixava a coluna de abas com
                ~70px de largura útil num dialog de ~340px (viewport 375px),
                cortando texto/inputs de verdade -- não só "apertado". Abaixo
                de sm: flex-col empilhado (metadados com scroll próprio
                limitado a 35vh, abas ocupando o resto via flex-1 min-h-0,
                mesmo padrão de "resto do espaço rola por conta própria" já
                usado no resto do arquivo) -- ComentarioFeed/AnexoList/
                HistoricoTimeline não precisaram mudar, só ganharam uma
                coluna mais estreita e alta em vez de larga e baixa. De sm
                pra cima, volta a ser o grid 270px+1fr original. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:grid sm:grid-cols-[270px_1fr]">
              {/* ESQUERDA: metadados */}
              <div className="scrollbar-discreta flex max-h-[35vh] shrink-0 flex-col gap-4 overflow-y-auto border-b border-border p-4.5 sm:max-h-none sm:shrink sm:border-r sm:border-b-0">
                <EditarDemandaSection
                  demanda={demanda}
                  podeEditar={podeEditar}
                  ativo={secaoAberta === "editar"}
                  aoAbrir={() => setSecaoAberta("editar")}
                  aoFechar={() => setSecaoAberta(null)}
                />

                <CampoMeta rotulo="Unidade">
                  <Pill>{demanda.unidade.nome}</Pill>
                </CampoMeta>
                {/* Setor/Categoria/Prazo/Descrição somem enquanto o
                    formulário de edição está aberto -- ele já mostra os
                    três como input, mostrar os dois ao mesmo tempo duplicaria. */}
                {secaoAberta !== "editar" && demanda.setor && (
                  <CampoMeta rotulo="Setor">
                    <Pill>{demanda.setor.nome}</Pill>
                  </CampoMeta>
                )}
                <CampoMeta rotulo="Tipo de gestão">
                  <Pill>{demanda.tipo_gestao.nome}</Pill>
                </CampoMeta>
                {secaoAberta !== "editar" && demanda.categoria && (
                  <CampoMeta rotulo="Categoria">
                    <Pill>{demanda.categoria.nome}</Pill>
                  </CampoMeta>
                )}

                {secaoAberta !== "editar" && (
                  <CampoMeta rotulo="Prazo">
                    {(() => {
                      const prazo = formatarPrazo(demanda.data_prevista);
                      return (
                        <span
                          className={cn(
                            "flex items-center gap-1.5",
                            prazo.atrasada && "text-destructive",
                            prazo.proxima && !prazo.atrasada && "text-destructive/70",
                          )}
                        >
                          <Calendar className="size-3.5 shrink-0" />
                          {prazo.texto}
                          {prazo.atrasada && " · atrasada"}
                        </span>
                      );
                    })()}
                  </CampoMeta>
                )}

                {demanda.aprovador && (
                  <CampoMeta rotulo="Aprovador">
                    <Pill>{nomeExibicao(demanda.aprovador)}</Pill>
                  </CampoMeta>
                )}

                <TransicaoStatusSection
                  demanda={demanda}
                  podeEscrever={podeEscrever}
                  ativo={secaoAberta === "status"}
                  aoAbrir={() => setSecaoAberta("status")}
                  aoFechar={() => setSecaoAberta(null)}
                  statusAlvoInicial={statusAlvoInicial}
                />

                <CampoMeta rotulo="Responsáveis">
                  <ResponsavelSection
                    demanda={demanda}
                    podeEscrever={podeEscrever}
                    ativo={secaoAberta === "responsavel"}
                    aoAbrir={() => setSecaoAberta("responsavel")}
                    aoFechar={() => setSecaoAberta(null)}
                    abrirComFormularioDeAdicionar={secaoInicial === "responsavel"}
                  />
                </CampoMeta>

                <div className="h-px bg-border" />

                {secaoAberta !== "editar" && (
                  <CampoMeta rotulo="Descrição">
                    <p className="rounded-md bg-muted/40 p-2.5 text-[13px] leading-relaxed font-normal text-foreground">
                      {demanda.descricao || "Sem descrição."}
                    </p>
                  </CampoMeta>
                )}

                <div className="mt-auto border-t border-border pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  Criado por <strong className="font-semibold text-foreground">
                    {nomeExibicao(demanda.solicitante)}
                  </strong>
                </div>
              </div>

              {/* DIREITA: abas */}
              <Tabs defaultValue="comentarios" className="min-h-0 flex-1 gap-0">
                <TabsList
                  variant="line"
                  className="h-11 w-full justify-start gap-4 rounded-none border-b border-border bg-transparent px-5"
                >
                  <TabsTrigger
                    value="comentarios"
                    className="gap-1.5 rounded-none px-1 text-[13px] data-[state=active]:shadow-none"
                  >
                    <MessageSquare className="size-3.5" />
                    Comentários
                    <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] font-bold text-muted-foreground">
                      {comentarios.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="anexos"
                    className="gap-1.5 rounded-none px-1 text-[13px] data-[state=active]:shadow-none"
                  >
                    <Paperclip className="size-3.5" />
                    Anexos
                    <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] font-bold text-muted-foreground">
                      {anexos.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="historico"
                    className="gap-1.5 rounded-none px-1 text-[13px] data-[state=active]:shadow-none"
                  >
                    <ClockIcon className="size-3.5" />
                    Histórico
                    <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] font-bold text-muted-foreground">
                      {historico.length}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comentarios" className="flex min-h-0 flex-col overflow-hidden">
                  <ComentarioFeed demandaId={demanda.id} podeComentar={podeEscrever} />
                </TabsContent>
                <TabsContent value="anexos" className="flex min-h-0 flex-col overflow-hidden">
                  <AnexoList demandaId={demanda.id} podeAnexar={podeEscrever} />
                </TabsContent>
                <TabsContent value="historico" className="flex min-h-0 flex-col overflow-hidden">
                  <HistoricoTimeline demandaId={demanda.id} />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
