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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAtualizarDocumentoLegalizacao,
  useDocumentoLegalizacao,
} from "@/hooks/useDocumentosLegalizacao";
import { useEvidenciasLegalizacao } from "@/hooks/useEvidenciasLegalizacao";
import { useHistoricoLegalizacao } from "@/hooks/useHistoricoLegalizacao";
import { useCriarProcessoRenovacao } from "@/hooks/useProcessoRenovacao";
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
// mesmo padrão já aceito no módulo pra rótulos pequenos e fixos (ex.
// formatarData, repetido em cada form de Admin em vez de um util central).
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
// propósito -- ver comentário em HistoricoRegulatorio, backend); uma ação
// nova cai no fallback abaixo (o próprio valor cru), não quebra a tela.
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

type Aba = "evidencias" | "historico";

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
  // transicionando pra Vencido), não dá pra distinguir dos dois casos só
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
  const [aba, setAba] = useState<Aba>("evidencias");
  const [mostrandoJustificativa, setMostrandoJustificativa] = useState(false);
  const [justificativa, setJustificativa] = useState("");

  const { documento, isLoading, error, mensagemErro, mutate } =
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
  const { criar: criarProcesso, isLoading: registrandoRenovacao } =
    useCriarProcessoRenovacao();

  function fechar() {
    setAba("evidencias");
    setMostrandoJustificativa(false);
    setJustificativa("");
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

  // Cria o ProcessoRenovacao (POST já é o "iniciar", RF-009) -- a tela de
  // acompanhamento (Protocolo/Conclusão) é a STC-381, ainda não existe;
  // esta chamada só move o documento pra Em andamento e deixa o processo
  // pronto pra a próxima etapa gerenciar.
  async function registrarRenovacao() {
    if (!documento) return;
    try {
      await criarProcesso({ documento_unidade: documento.id });
      await mutate();
      toast.success("Processo de renovação iniciado.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  const prazo = documento ? prazoDocumento(documento) : null;
  const responsavel = documento ? responsavelPrincipal(documento) : undefined;
  const mostraMovimentacaoProfissional = documento
    ? CODIGOS_MOVIMENTACAO_PROFISSIONAL.has(documento.tipo_documento.codigo)
    : false;
  const podeRegistrarRenovacao =
    documento &&
    documento.status !== "nao_aplicavel" &&
    documento.status !== "unidade_encerramento";
  const podeMarcarNaoAplicavel =
    documento && documento.status !== "nao_aplicavel";

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="flex max-h-[88vh] max-w-[min(980px,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0">
        {isLoading && !documento ? (
          <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : error ? (
          <div className="flex h-[420px] items-center justify-center text-sm text-destructive">
            Não foi possível carregar o documento: {mensagemErro}
          </div>
        ) : documento && prazo ? (
          <>
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[17px] font-semibold text-foreground">
                    {documento.tipo_documento.nome}
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {documento.unidade.nome} ·{" "}
                    {LABEL_CATEGORIA[documento.tipo_documento.categoria]}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase",
                    COR_STATUS_BADGE[documento.status],
                  )}
                >
                  {LABEL_STATUS[documento.status]}
                </span>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden sm:grid-cols-[280px_1fr]">
              <div className="scrollbar-discreta flex flex-col gap-4 overflow-y-auto border-b border-border p-4.5 sm:border-r sm:border-b-0">
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
                      {documento.validade
                        ? `${prazo.texto.charAt(0).toUpperCase() + prazo.texto.slice(1)} (validade ${formatarData(documento.validade)}).`
                        : `${prazo.texto.charAt(0).toUpperCase() + prazo.texto.slice(1)}.`}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                    Unidade
                  </span>
                  <span className="text-sm font-medium">
                    {documento.unidade.nome}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                    Área responsável
                  </span>
                  <span className="w-fit rounded-sm bg-muted px-2 py-0.5 text-[12.5px]">
                    {
                      ROTULO_AREA_RESPONSAVEL[
                        documento.tipo_documento.area_responsavel
                      ]
                    }
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                    Responsável operacional
                  </span>
                  {responsavel ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-secondary-foreground">
                        {iniciaisDe(nomeExibicao(responsavel.usuario))}
                      </span>
                      {nomeExibicao(responsavel.usuario)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sem responsável
                    </span>
                  )}
                </div>

                <div className="h-px bg-border" />

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                    Validade
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      prazo.urgencia === "vencido" && "font-bold text-red-600",
                    )}
                  >
                    {documento.validade
                      ? formatarData(documento.validade)
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                    Antecedência do alerta
                  </span>
                  <span className="text-sm font-medium">
                    {documento.regra_aplicada
                      ? `${documento.regra_aplicada.antecedencia_dias} dias`
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                    Criticidade
                  </span>
                  {documento.regra_aplicada ? (
                    <span
                      className={cn(
                        "w-fit rounded-sm border px-2 py-0.5 text-[12.5px] font-semibold",
                        documento.regra_aplicada.criticidade === "alta"
                          ? COR_CRITICIDADE_ALTA
                          : "border-border bg-muted text-foreground",
                      )}
                    >
                      {LABEL_CRITICIDADE[documento.regra_aplicada.criticidade]}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>

                <div className="h-px bg-border" />

                {mostrandoJustificativa ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="det-justificativa" className="text-xs">
                      Justificativa <span className="text-destructive">*</span>
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
                        disabled={!justificativa.trim() || salvandoNaoAplicavel}
                        onClick={() => void confirmarNaoAplicavel()}
                      >
                        {salvandoNaoAplicavel ? "Salvando..." : "Confirmar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {podeRegistrarRenovacao && (
                      <Button
                        disabled={registrandoRenovacao}
                        onClick={() => void registrarRenovacao()}
                      >
                        {registrandoRenovacao
                          ? "Registrando..."
                          : "Registrar renovação"}
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
                  </>
                )}

                <div className="mt-auto border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <strong className="font-semibold text-foreground">
                    Setor de apoio:
                  </strong>{" "}
                  {documento.tipo_documento.setor_apoio ||
                    "nenhum informado para este tipo de documento."}
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden">
                <div className="flex shrink-0 gap-5 border-b border-border px-5">
                  <button
                    type="button"
                    onClick={() => setAba("evidencias")}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 border-transparent py-3 text-[13px] font-medium text-muted-foreground",
                      aba === "evidencias" &&
                        "border-secondary font-semibold text-secondary",
                    )}
                  >
                    Evidências
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-bold text-muted-foreground">
                      {evidencias.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAba("historico")}
                    className={cn(
                      "flex items-center gap-1.5 border-b-2 border-transparent py-3 text-[13px] font-medium text-muted-foreground",
                      aba === "historico" &&
                        "border-secondary font-semibold text-secondary",
                    )}
                  >
                    Histórico
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-bold text-muted-foreground">
                      {historico.length}
                    </span>
                  </button>
                </div>

                <div className="scrollbar-discreta flex-1 space-y-2.5 overflow-y-auto p-5">
                  {aba === "evidencias" ? (
                    carregandoEvidencias ? (
                      <p className="text-sm text-muted-foreground">
                        Carregando...
                      </p>
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
                      evidencias.map((evidencia) => (
                        <ItemEvidencia
                          key={evidencia.id}
                          evidencia={evidencia}
                        />
                      ))
                    )
                  ) : carregandoHistorico ? (
                    <p className="text-sm text-muted-foreground">
                      Carregando...
                    </p>
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
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
