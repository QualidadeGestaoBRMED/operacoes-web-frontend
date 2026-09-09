"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Download,
  FileText,
  History as HistoryIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ProcessoRenovacaoModal } from "./ProcessoRenovacaoModal";
import {
  useAtualizarDocumentoLegalizacao,
  useDocumentoLegalizacao,
} from "@/hooks/useDocumentosLegalizacao";
import { useEvidenciasLegalizacao } from "@/hooks/useEvidenciasLegalizacao";
import { useHistoricoLegalizacao } from "@/hooks/useHistoricoLegalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import { urlAbsolutaDaEvidencia } from "@/lib/legalizacao";
import {
  COR_CRITICIDADE_ALTA,
  COR_STATUS_BADGE,
  LABEL_CATEGORIA,
  LABEL_CRITICIDADE,
  LABEL_STATUS,
  prazoDocumento,
  responsavelPrincipal,
} from "@/lib/legalizacaoMatriz";
import {
  cn,
  formatarDataHora,
  formatarTamanhoArquivo,
  iniciaisDe,
  nomeExibicao,
} from "@/lib/utils";
import type {
  AreaResponsavelDocumento,
  EvidenciaRegulatoria,
  HistoricoRegulatorio,
} from "@/types/legalizacao";

// Mesmo raciocínio de CODIGO_TIPO_DOCUMENTO_DOSIMETRIA (backend, RN12) --
// sem flag estrutural pra "este tipo aceita movimentação profissional",
// código fixo do catálogo seed (RN11). CRM/RT tem 2 códigos hoje (CREMERJ/
// COREN, ver seed_catalogo_legalizacao.py); se novos conselhos profissionais
// forem cadastrados no catálogo (ex. biomedicina, citado no Plano de Ação),
// este conjunto precisa crescer junto -- não é um campo estrutural real.
const CODIGOS_MOVIMENTACAO_PROFISSIONAL = new Set([
  "cnes",
  "dosimetria",
  "registro-cremerj",
  "registro-coren",
]);

// Duplicado de TabelaTiposDocumento.tsx (Administração) de propósito --
// mesmo padrão já aceito no módulo pra rótulos pequenos e fixos.
const ROTULO_AREA_RESPONSAVEL: Record<AreaResponsavelDocumento, string> = {
  legalizacao: "Legalização",
  coordenacao: "Coordenação da Unidade",
};

function formatarData(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function extensaoDe(nomeArquivo: string) {
  return nomeArquivo.includes(".")
    ? nomeArquivo.split(".").pop()!.toLowerCase()
    : "";
}

// Mesma paleta de AnexoList.tsx (Gestão de Demandas) -- mesmos tipos de
// arquivo aceitos nos dois módulos.
const COR_POR_EXTENSAO: Record<string, string> = {
  pdf: "bg-red-600",
  doc: "bg-blue-600",
  docx: "bg-blue-600",
  pptx: "bg-orange-600",
  xlsx: "bg-green-600",
  png: "bg-purple-600",
  jpg: "bg-purple-600",
  jpeg: "bg-purple-600",
};

// Rótulo amigável por `acao` de HistoricoRegulatorio -- lista fechada,
// espelhando todo registrar_historico(...) real do backend (legalizacao/
// views.py, tasks.py). `acao` é string livre no model (sem choices, de
// propósito); uma ação nova cai no fallback abaixo (o próprio valor cru),
// não quebra a tela.
const LABEL_ACAO_HISTORICO: Record<string, string> = {
  status: "Status",
  validade: "Validade",
  justificativa_excecao: "Justificativa",
  regra_aplicada: "Regra de prazo aplicada",
  responsavel: "Responsável",
  evidencia: "Evidência",
  movimentacao_profissional: "Movimentação profissional",
  processo_status: "Status do processo de renovação",
  processo_protocolo_numero: "Número do protocolo",
  processo_protocolo_orgao: "Órgão do protocolo",
  processo_protocolo_data: "Data do protocolo",
  processo_observacoes: "Observações do processo",
  processo_data_conclusao: "Data de conclusão do processo",
  processo_responsavel: "Responsável pelo processo",
};

// Mesmo padrão de CampoMeta (DetalheCard.tsx, Gestão de Demandas) -- rótulo
// pequeno em caixa alta acima do valor.
function CampoMeta({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-[13px] font-medium text-foreground">
      {children}
    </span>
  );
}

function ItemEvidencia({ evidencia }: { evidencia: EvidenciaRegulatoria }) {
  const extensao = extensaoDe(evidencia.nome_original);
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-lg border border-border bg-background p-2.5",
        evidencia.vigente && "border-green-600/40 bg-green-600/5",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white uppercase",
          COR_POR_EXTENSAO[extensao] ?? "bg-muted-foreground",
        )}
      >
        {extensao || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 truncate text-[13.5px] font-medium text-foreground">
          <span className="truncate">{evidencia.nome_original}</span>
          {evidencia.vigente && (
            <span className="shrink-0 rounded-full bg-green-600/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-green-700 uppercase">
              Vigente
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
          {formatarTamanhoArquivo(evidencia.tamanho_bytes)} · enviado por{" "}
          {nomeExibicao(evidencia.usuario)} ·{" "}
          {formatarDataHora(evidencia.created_at)}
        </div>
      </div>
      <a
        href={urlAbsolutaDaEvidencia(evidencia.arquivo)}
        target="_blank"
        rel="noreferrer"
        download={evidencia.nome_original}
        title="Baixar"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Download className="size-4" />
      </a>
    </div>
  );
}

function ItemHistorico({ item }: { item: HistoricoRegulatorio }) {
  const rotuloAcao = LABEL_ACAO_HISTORICO[item.acao] ?? item.acao;
  // usuario null aqui não é "removido" (nomeOuRemovido, usado em outros
  // módulos) -- é ação automática do sistema (ex.: varredura diária
  // transicionando pra Vencido), não dá pra distinguir os dois casos só
  // pelos dados (ver comentário em HistoricoRegulatorio, types/legalizacao.ts).
  const autor = item.usuario ? nomeExibicao(item.usuario) : "Sistema";
  const Icone = item.acao === "evidencia" ? FileText : HistoryIcon;
  const corDot =
    item.acao === "movimentacao_profissional"
      ? "border-red-600/50 bg-red-600/10 text-red-700"
      : item.acao === "evidencia"
        ? "border-amber-600/50 bg-amber-600/10 text-amber-700"
        : "border-secondary/50 bg-secondary/10 text-secondary";

  return (
    <div className="relative flex gap-3.5 pb-4 last:pb-0">
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
          corDot,
        )}
      >
        <Icone className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] text-foreground">
          <strong className="font-semibold">{autor}</strong> alterou{" "}
          <strong className="font-semibold">{rotuloAcao.toLowerCase()}</strong>
          {item.valor_anterior && (
            <>
              {" "}
              de <strong>&quot;{item.valor_anterior}&quot;</strong>
            </>
          )}
          {item.valor_novo && (
            <>
              {" "}
              para <strong>&quot;{item.valor_novo}&quot;</strong>
            </>
          )}
          .
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {formatarDataHora(item.created_at)}
        </p>
      </div>
    </div>
  );
}

export function DetalheDocumentoModal({
  documentoId,
  onOpenChange,
}: {
  documentoId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const aberto = documentoId !== null;
  const [mostrandoJustificativa, setMostrandoJustificativa] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  // Só a vigente aparece por padrão, com ação explícita pra ver o histórico
  // de evidências (critério do texto da issue) -- reseta ao trocar de
  // documento, pra não vazar "expandido" de um documento pro próximo.
  const [mostrandoHistoricoEvidencias, setMostrandoHistoricoEvidencias] =
    useState(false);
  const [mostrandoProcessoRenovacao, setMostrandoProcessoRenovacao] =
    useState(false);

  const { documento, isLoading, mensagemErro, mutate } =
    useDocumentoLegalizacao(documentoId);
  const {
    evidencias,
    isLoading: carregandoEvidencias,
    mensagemErro: erroEvidencias,
  } = useEvidenciasLegalizacao(aberto ? documentoId : null);
  const {
    historico,
    isLoading: carregandoHistorico,
    mensagemErro: erroHistorico,
  } = useHistoricoLegalizacao(aberto ? documentoId : null);
  const { atualizar, isLoading: salvandoNaoAplicavel } =
    useAtualizarDocumentoLegalizacao();

  function fechar() {
    setMostrandoJustificativa(false);
    setJustificativa("");
    setMostrandoHistoricoEvidencias(false);
    setMostrandoProcessoRenovacao(false);
    onOpenChange(false);
  }

  async function confirmarNaoAplicavel() {
    if (!documento || !justificativa.trim()) return;
    try {
      await atualizar({
        id: documento.id,
        payload: {
          status: "nao_aplicavel",
          justificativa_excecao: justificativa.trim(),
        },
      });
      await mutate();
      toast.success("Documento marcado como Não aplicável.");
      setMostrandoJustificativa(false);
      setJustificativa("");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  const prazo = documento ? prazoDocumento(documento) : null;
  const responsavel = documento ? responsavelPrincipal(documento) : undefined;
  const evidenciaVigente = evidencias.find((evidencia) => evidencia.vigente);
  const evidenciasExibidas = mostrandoHistoricoEvidencias
    ? evidencias
    : evidenciaVigente
      ? [evidenciaVigente]
      : [];
  const mostraMovimentacaoProfissional = documento
    ? CODIGOS_MOVIMENTACAO_PROFISSIONAL.has(documento.tipo_documento.codigo)
    : false;
  // Em andamento/Protocolado já são um processo de renovação em curso
  // (Plano de Ação §7: "Em andamento (solicitação iniciada) → Protocolado
  // → Renovação concluída → volta pra Regular") -- "Registrar renovação"
  // começa um processo NOVO, não faz sentido nesses dois estados. O
  // acompanhamento do processo já existente é a STC-381 (ainda não existe).
  const processoJaEmCurso =
    documento?.status === "em_andamento" || documento?.status === "protocolado";
  const podeRegistrarRenovacao =
    documento &&
    !processoJaEmCurso &&
    documento.status !== "nao_aplicavel" &&
    documento.status !== "unidade_encerramento";
  const podeMarcarNaoAplicavel =
    documento && documento.status !== "nao_aplicavel";

  return (
    <>
      <Dialog open={aberto} onOpenChange={(open) => !open && fechar()}>
        <DialogContent
          showCloseButton
          className="flex max-h-[88vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          {isLoading ? (
            <div className="flex flex-1 flex-col gap-4 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-4 h-full w-full" />
            </div>
          ) : mensagemErro || !documento || !prazo ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
              {mensagemErro
                ? `Não foi possível carregar o documento: ${mensagemErro}`
                : "Não foi possível carregar este documento."}
            </div>
          ) : (
            <>
              {/* Mesma estrutura de DetalheCard.tsx (Gestão de Demandas):
                título sozinho na 1ª linha -- o botão de fechar do
                DialogContent (absolute top-4 right-4) fica sem disputa de
                espaço com nenhum badge. Status entra numa linha própria
                abaixo, junto do resto do cabeçalho, não ao lado do título. */}
              <DialogHeader className="gap-2.5 border-b border-border px-6 py-4">
                <DialogTitle className="text-[17px] leading-snug font-semibold text-foreground">
                  {documento.tipo_documento.nome}
                </DialogTitle>
                <p className="text-[12.5px] text-muted-foreground">
                  {documento.unidade.nome} ·{" "}
                  {LABEL_CATEGORIA[documento.tipo_documento.categoria]}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase",
                      COR_STATUS_BADGE[documento.status],
                    )}
                  >
                    {LABEL_STATUS[documento.status]}
                  </span>
                </div>
              </DialogHeader>

              {/* Mesmo padrão responsivo de DetalheCard.tsx (Gestão de
                Demandas, STC-186): abaixo de sm, metadados empilham em
                cima (scroll próprio limitado a 35vh) e as abas ocupam o
                resto -- de sm pra cima, volta a ser o grid 270px+1fr. */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:grid sm:grid-cols-[270px_1fr]">
                <div className="scrollbar-discreta flex max-h-[35vh] shrink-0 flex-col gap-4 overflow-y-auto border-b border-border p-4.5 sm:max-h-none sm:shrink sm:border-r sm:border-b-0">
                  {(prazo.urgencia === "vencido" ||
                    prazo.urgencia === "proximo") && (
                    <div
                      className={cn(
                        "flex items-start gap-2.5 rounded-md border p-3 text-[12.5px]",
                        prazo.urgencia === "vencido"
                          ? "border-red-600/25 bg-red-600/5 text-foreground"
                          : "border-amber-600/25 bg-amber-600/5 text-foreground",
                      )}
                    >
                      <AlertTriangle
                        className={cn(
                          "mt-0.5 size-3.5 shrink-0",
                          prazo.urgencia === "vencido"
                            ? "text-red-600"
                            : "text-amber-700",
                        )}
                      />
                      <span>
                        {prazo.texto.charAt(0).toUpperCase() +
                          prazo.texto.slice(1)}
                        {documento.validade &&
                          ` (validade ${formatarData(documento.validade)}).`}
                      </span>
                    </div>
                  )}

                  <CampoMeta rotulo="Unidade">
                    {documento.unidade.nome}
                  </CampoMeta>
                  <CampoMeta rotulo="Área responsável">
                    <Pill>
                      {
                        ROTULO_AREA_RESPONSAVEL[
                          documento.tipo_documento.area_responsavel
                        ]
                      }
                    </Pill>
                  </CampoMeta>
                  <CampoMeta rotulo="Responsável operacional">
                    {responsavel ? (
                      <>
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-secondary-foreground">
                          {iniciaisDe(nomeExibicao(responsavel.usuario))}
                        </span>
                        {nomeExibicao(responsavel.usuario)}
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Sem responsável
                      </span>
                    )}
                  </CampoMeta>

                  <div className="h-px bg-border" />

                  <CampoMeta rotulo="Validade">
                    <span
                      className={cn(
                        prazo.urgencia === "vencido" &&
                          "font-bold text-red-600",
                      )}
                    >
                      {documento.validade
                        ? formatarData(documento.validade)
                        : "—"}
                    </span>
                  </CampoMeta>
                  <CampoMeta rotulo="Antecedência do alerta">
                    {documento.regra_aplicada
                      ? `${documento.regra_aplicada.antecedencia_dias} dias`
                      : "—"}
                  </CampoMeta>
                  <CampoMeta rotulo="Criticidade">
                    {documento.regra_aplicada ? (
                      <span
                        className={cn(
                          "rounded-sm border px-2 py-0.5 text-[12.5px] font-semibold",
                          documento.regra_aplicada.criticidade === "alta"
                            ? COR_CRITICIDADE_ALTA
                            : "border-border bg-muted text-foreground",
                        )}
                      >
                        {
                          LABEL_CRITICIDADE[
                            documento.regra_aplicada.criticidade
                          ]
                        }
                      </span>
                    ) : (
                      "—"
                    )}
                  </CampoMeta>

                  <div className="h-px bg-border" />

                  {mostrandoJustificativa ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="det-justificativa" className="text-xs">
                        Justificativa{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="det-justificativa"
                        rows={3}
                        value={justificativa}
                        onChange={(evento) =>
                          setJustificativa(evento.target.value)
                        }
                        placeholder="Por que este documento não se aplica a esta unidade?"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setMostrandoJustificativa(false);
                            setJustificativa("");
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={
                            !justificativa.trim() || salvandoNaoAplicavel
                          }
                          onClick={() => void confirmarNaoAplicavel()}
                        >
                          {salvandoNaoAplicavel ? "Salvando..." : "Confirmar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {processoJaEmCurso && (
                        // Acompanhamento do processo (Protocolo/Conclusão) é
                        // a STC-381, ainda não existe -- por enquanto só
                        // evita reabrir "Registrar renovação" sobre um
                        // processo já em curso.
                        <p className="text-[12.5px] text-muted-foreground">
                          Processo de renovação em andamento.
                        </p>
                      )}
                      {podeRegistrarRenovacao && (
                        <Button
                          onClick={() => setMostrandoProcessoRenovacao(true)}
                        >
                          Registrar renovação
                        </Button>
                      )}
                      {podeMarcarNaoAplicavel && (
                        <Button
                          variant="outline"
                          onClick={() => setMostrandoJustificativa(true)}
                        >
                          Marcar como Não aplicável
                        </Button>
                      )}
                      {mostraMovimentacaoProfissional && (
                        // onClick chega na STC-382 -- por enquanto só a
                        // visibilidade condicional (critério de aceite desta
                        // issue) está implementada.
                        <Button
                          variant="outline"
                          className="border-red-600/40 text-red-700 hover:bg-red-600/5 hover:text-red-700"
                        >
                          Reportar Movimentação Profissional
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="mt-auto border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                    <strong className="font-semibold text-foreground">
                      Setor de apoio:
                    </strong>{" "}
                    {documento.tipo_documento.setor_apoio ||
                      "nenhum informado para este tipo de documento."}
                  </div>
                </div>

                <Tabs
                  defaultValue="evidencias"
                  className="min-h-0 flex-1 gap-0"
                >
                  <TabsList
                    variant="line"
                    className="h-11 w-full justify-start gap-4 rounded-none border-b border-border bg-transparent px-5"
                  >
                    <TabsTrigger
                      value="evidencias"
                      className="gap-1.5 rounded-none px-1 text-[13px] data-[state=active]:shadow-none"
                    >
                      <FileText className="size-3.5" />
                      Evidências
                      <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] font-bold text-muted-foreground">
                        {evidencias.length}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="historico"
                      className="gap-1.5 rounded-none px-1 text-[13px] data-[state=active]:shadow-none"
                    >
                      <HistoryIcon className="size-3.5" />
                      Histórico
                      <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] font-bold text-muted-foreground">
                        {historico.length}
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="evidencias"
                    className="scrollbar-discreta flex-1 space-y-2.5 overflow-y-auto p-5"
                  >
                    {carregandoEvidencias ? (
                      <div className="flex flex-col gap-2.5">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                      </div>
                    ) : erroEvidencias ? (
                      <p className="text-sm text-destructive">
                        Não foi possível carregar as evidências:{" "}
                        {erroEvidencias}
                      </p>
                    ) : evidencias.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma evidência enviada ainda.
                      </p>
                    ) : (
                      <>
                        {evidenciasExibidas.map((evidencia) => (
                          <ItemEvidencia
                            key={evidencia.id}
                            evidencia={evidencia}
                          />
                        ))}
                        {evidencias.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setMostrandoHistoricoEvidencias((atual) => !atual)
                            }
                            className="text-[12.5px] font-medium text-secondary hover:underline"
                          >
                            {mostrandoHistoricoEvidencias
                              ? "Ver só a vigente"
                              : `Ver histórico de evidências (${evidencias.length - 1} anterior${evidencias.length - 1 === 1 ? "" : "es"})`}
                          </button>
                        )}
                      </>
                    )}
                  </TabsContent>
                  <TabsContent
                    value="historico"
                    className="scrollbar-discreta flex-1 overflow-y-auto p-5"
                  >
                    {carregandoHistorico ? (
                      <div className="flex flex-col gap-2.5">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : erroHistorico ? (
                      <p className="text-sm text-destructive">
                        Não foi possível carregar o histórico: {erroHistorico}
                      </p>
                    ) : historico.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum registro de histórico ainda.
                      </p>
                    ) : (
                      historico.map((item) => (
                        <ItemHistorico key={item.id} item={item} />
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ProcessoRenovacaoModal
        documento={documento ?? null}
        aberto={mostrandoProcessoRenovacao}
        onOpenChange={setMostrandoProcessoRenovacao}
        onRegistrado={() => void mutate()}
      />
    </>
  );
}
