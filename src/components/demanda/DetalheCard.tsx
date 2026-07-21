"use client";

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
import { COLUNAS, COR_PRIORIDADE, LABEL_PRIORIDADE } from "@/lib/kanban";
import { cn, iniciaisDe, nomeExibicao } from "@/lib/utils";
import { AnexoList } from "./AnexoList";
import { ComentarioFeed } from "./ComentarioFeed";
import { HistoricoTimeline } from "./HistoricoTimeline";

const ROTULO_STATUS: Record<string, string> = Object.fromEntries(
  COLUNAS.map((coluna) => [coluna.status, coluna.titulo]),
);

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
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(`${dataPrevista}T00:00:00`);
  const diasRestantes = Math.round((prazo.getTime() - hoje.getTime()) / 86_400_000);
  return {
    texto: `${dia}/${mes}/${ano}`,
    atrasada: diasRestantes < 0,
    proxima: diasRestantes >= 0 && diasRestantes <= 3,
  };
}

export function DetalheCard({
  demandaId,
  onOpenChange,
}: {
  demandaId: number | null;
  onOpenChange: (open: boolean) => void;
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

            <div className="grid min-h-0 flex-1 grid-cols-[270px_1fr] overflow-hidden">
              {/* ESQUERDA: metadados */}
              <div className="scrollbar-discreta flex flex-col gap-4 overflow-y-auto border-r border-border p-4.5">
                <CampoMeta rotulo="Unidade">
                  <Pill>{demanda.unidade.nome}</Pill>
                </CampoMeta>
                {demanda.setor && (
                  <CampoMeta rotulo="Setor">
                    <Pill>{demanda.setor.nome}</Pill>
                  </CampoMeta>
                )}
                <CampoMeta rotulo="Tipo de gestão">
                  <Pill>{demanda.tipo_gestao.nome}</Pill>
                </CampoMeta>
                {demanda.categoria && (
                  <CampoMeta rotulo="Categoria">
                    <Pill>{demanda.categoria.nome}</Pill>
                  </CampoMeta>
                )}

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

                <CampoMeta rotulo="Responsáveis">
                  <div className="flex w-full flex-col gap-1.5">
                    {demanda.responsaveis.length === 0 ? (
                      <span className="text-sm text-muted-foreground">Sem responsáveis</span>
                    ) : (
                      demanda.responsaveis.map((responsavel) => (
                        <div key={responsavel.usuario.id} className="flex items-center gap-1.5">
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-secondary-foreground">
                            {iniciaisDe(nomeExibicao(responsavel.usuario))}
                          </div>
                          <span className="text-[13.5px] font-medium text-foreground">
                            {nomeExibicao(responsavel.usuario)}
                          </span>
                          {responsavel.tipo === "principal" && (
                            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase">
                              principal
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CampoMeta>

                <div className="h-px bg-border" />

                <CampoMeta rotulo="Descrição">
                  <p className="rounded-md bg-muted/40 p-2.5 text-[13px] leading-relaxed font-normal text-foreground">
                    {demanda.descricao || "Sem descrição."}
                  </p>
                </CampoMeta>

                <div className="mt-auto border-t border-border pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  Criado por <strong className="font-semibold text-foreground">
                    {nomeExibicao(demanda.solicitante)}
                  </strong>
                </div>
              </div>

              {/* DIREITA: abas */}
              <Tabs defaultValue="comentarios" className="min-h-0 gap-0">
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
