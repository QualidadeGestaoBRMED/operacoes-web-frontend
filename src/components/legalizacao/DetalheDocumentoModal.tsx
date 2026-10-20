"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Download,
  FileText,
  History as HistoryIcon,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AvatarUsuario } from "@/components/AvatarUsuario";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DialogNovaVersao } from "@/components/admin/legalizacao/FormNovaVersaoRegra";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EditarDocumentoSection } from "./EditarDocumentoSection";
import { MovimentacaoProfissionalModal } from "./MovimentacaoProfissionalModal";
import {
  formatarDataDeDatetime,
  LABEL_STATUS_PROCESSO,
  ProcessoRenovacaoModal,
} from "./ProcessoRenovacaoModal";
import {
  useAdicionarResponsavelLegalizacao,
  useAtualizarDocumentoLegalizacao,
  useCandidatosResponsaveis,
  useDocumentoLegalizacao,
  useExcluirDocumentoLegalizacao,
  useRemoverResponsavelLegalizacao,
  useReverterDocumentoLegalizacao,
} from "@/hooks/useDocumentosLegalizacao";
import { useAuth } from "@/hooks/useAuth";
import { useEvidenciasLegalizacao } from "@/hooks/useEvidenciasLegalizacao";
import { useHistoricoLegalizacao } from "@/hooks/useHistoricoLegalizacao";
import { useProcessosRenovacao } from "@/hooks/useProcessoRenovacao";
import { extrairMensagemErro } from "@/lib/erros";
import { urlAbsolutaDaEvidencia } from "@/lib/legalizacao";
import { administra } from "@/lib/redes";
import {
  CODIGOS_MOVIMENTACAO_PROFISSIONAL,
  COR_STATUS_BADGE,
  LABEL_CATEGORIA,
  LABEL_STATUS,
  prazoDocumento,
} from "@/lib/legalizacaoMatriz";
import {
  cn,
  formatarDataHora,
  formatarTamanhoArquivo,
  iniciaisDe,
  nomeExibicao,
} from "@/lib/utils";
import type { Usuario } from "@/types";
import type {
  AreaResponsavelDocumento,
  ComprovanteProtocolo,
  EvidenciaRegulatoria,
  HistoricoRegulatorio,
  ProcessoRenovacao,
  StatusDocumento,
  StatusProcessoRenovacao,
} from "@/types/legalizacao";

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
  comprovante_protocolo: "Comprovante de protocolo",
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

// Linha de arquivo das abas Evidências e Protocolo: ícone da extensão, nome,
// tamanho, quem enviou, quando, e o download.
function ItemArquivo({
  nome,
  tamanhoBytes,
  usuario,
  enviadoEm,
  url,
  vigente = false,
}: {
  nome: string;
  tamanhoBytes: number;
  usuario: Usuario;
  enviadoEm: string;
  url: string;
  vigente?: boolean;
}) {
  const extensao = extensaoDe(nome);
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-lg border border-border bg-background p-2.5",
        vigente && "border-green-600/40 bg-green-600/5",
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
        <div className="flex items-center gap-2 text-[13.5px] font-medium text-foreground">
          {/* min-w-0: achado testando com nome de arquivo longo -- sem
              isso, um <span> filho de flex não encolhe abaixo do próprio
              conteúdo (min-width: auto é o default), então o truncate
              nunca entrava em ação e o nome estourava a área do item. */}
          <span className="min-w-0 flex-1 truncate">{nome}</span>
          {vigente && (
            <span className="shrink-0 rounded-full bg-green-600/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-green-700 uppercase">
              Vigente
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
          {formatarTamanhoArquivo(tamanhoBytes)} · enviado por{" "}
          {nomeExibicao(usuario)} · {formatarDataHora(enviadoEm)}
        </div>
      </div>
      <a
        href={urlAbsolutaDaEvidencia(url)}
        target="_blank"
        rel="noreferrer"
        download={nome}
        title="Baixar"
        aria-label={`Baixar ${nome}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Download className="size-4" />
      </a>
    </div>
  );
}

function ItemEvidencia({ evidencia }: { evidencia: EvidenciaRegulatoria }) {
  return (
    <ItemArquivo
      nome={evidencia.nome_original}
      tamanhoBytes={evidencia.tamanho_bytes}
      usuario={evidencia.usuario}
      enviadoEm={evidencia.created_at}
      url={evidencia.arquivo}
      vigente={evidencia.vigente}
    />
  );
}

function ItemComprovante({ comprovante }: { comprovante: ComprovanteProtocolo }) {
  return (
    <ItemArquivo
      nome={comprovante.nome_original}
      tamanhoBytes={comprovante.tamanho_bytes}
      usuario={comprovante.usuario}
      enviadoEm={comprovante.created_at}
      url={comprovante.arquivo}
    />
  );
}

// Um bloco por renovação com comprovante (STC-772): quando começou, em que
// status está e o número do protocolo, se houver.
function GrupoComprovantes({ processo }: { processo: ProcessoRenovacao }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11.5px] text-muted-foreground">
        <strong className="font-semibold text-foreground">
          Renovação de {formatarDataDeDatetime(processo.created_at)}
        </strong>{" "}
        · {LABEL_STATUS_PROCESSO[processo.status]}
        {processo.protocolo_numero && ` · Protocolo ${processo.protocolo_numero}`}
      </p>
      {processo.comprovantes_protocolo.map((comprovante) => (
        <ItemComprovante key={comprovante.id} comprovante={comprovante} />
      ))}
    </div>
  );
}

// HistoricoRegulatorio.valor_anterior/valor_novo guardam o valor cru do
// campo que mudou -- pra "status" e "processo_status" isso é o código do
// enum (ex.: "em_andamento"), técnico demais pra aparecer direto na tela
// (achado testando com o time). Os outros `acao` já são texto livre
// (observações, número de protocolo, nome de arquivo etc.), não precisam
// de tradução nenhuma.
function valorHistoricoTraduzido(acao: string, valor: string): string {
  if (acao === "status") return LABEL_STATUS[valor as StatusDocumento] ?? valor;
  if (acao === "processo_status")
    return LABEL_STATUS_PROCESSO[valor as StatusProcessoRenovacao] ?? valor;
  return valor;
}

function ItemHistorico({ item }: { item: HistoricoRegulatorio }) {
  const rotuloAcao = LABEL_ACAO_HISTORICO[item.acao] ?? item.acao;
  // usuario null aqui não é "removido" (nomeOuRemovido, usado em outros
  // módulos) -- é ação automática do sistema (ex.: varredura diária
  // transicionando pra Vencido), não dá pra distinguir os dois casos só
  // pelos dados (ver comentário em HistoricoRegulatorio, types/legalizacao.ts).
  const autor = item.usuario ? nomeExibicao(item.usuario) : "Sistema";
  const ehArquivo =
    item.acao === "evidencia" || item.acao === "comprovante_protocolo";
  const Icone = ehArquivo ? FileText : HistoryIcon;
  const corDot =
    item.acao === "movimentacao_profissional"
      ? "border-red-600/50 bg-red-600/10 text-red-700"
      : ehArquivo
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
              de{" "}
              <strong>
                &quot;{valorHistoricoTraduzido(item.acao, item.valor_anterior)}
                &quot;
              </strong>
            </>
          )}
          {item.valor_novo && (
            <>
              {" "}
              para{" "}
              <strong>
                &quot;{valorHistoricoTraduzido(item.acao, item.valor_novo)}
                &quot;
              </strong>
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
  const [
    mostrandoMovimentacaoProfissional,
    setMostrandoMovimentacaoProfissional,
  ] = useState(false);
  const [mostrandoConfirmarReversao, setMostrandoConfirmarReversao] =
    useState(false);
  const [mostrandoConfirmarExclusao, setMostrandoConfirmarExclusao] =
    useState(false);
  // STC-502 (pedido de cliente): editar status/validade direto no modal,
  // no mesmo padrão de EditarDemandaSection.tsx (Gestão de Demandas).
  // Mutuamente exclusivo com mostrandoJustificativa -- não faz sentido as
  // duas formas abertas ao mesmo tempo (ver aoAbrirEdicao/setMostrandoJustificativa
  // abaixo).
  const [mostrandoEdicao, setMostrandoEdicao] = useState(false);
  // STC-499/502: corrigir a Antecedência do alerta sempre cria uma nova
  // versão de regra (design append-only, RegraDocumento nunca é editada
  // in-place) -- mesmo diálogo já usado no catálogo (FormNovaVersaoRegra.tsx),
  // pré-preenchido com o documento já em mãos.
  const [mostrandoNovaVersaoRegra, setMostrandoNovaVersaoRegra] =
    useState(false);
  // STC-518: editar responsável operacional de um documento já cadastrado
  // -- cada marcar/desmarcar já persiste na hora (POST/DELETE), sem
  // Salvar/Cancelar (diferente de mostrandoEdicao acima) porque o endpoint
  // já é atômico por usuário, não um PATCH em lote.
  const [mostrandoEdicaoResponsaveis, setMostrandoEdicaoResponsaveis] =
    useState(false);
  const [buscaResponsavel, setBuscaResponsavel] = useState("");
  // Guarda o id sendo processado só pra saber QUAL chip mostrar como
  // "removendo" (opacidade) -- mas o disabled de TODOS os botões de
  // adicionar/remover é `processandoResponsavelId !== null` (achado em
  // revisão de falhas críticas: travar só o botão do mesmo usuário
  // deixava clicar em OUTRO candidato antes do 1º `mutate()` resolver;
  // com 0 responsáveis ainda, os dois liam `documento.responsaveis.
  // length === 0` desatualizado e mandavam `principal: true` ao mesmo
  // tempo, colidindo com a constraint de único principal no backend).
  const [processandoResponsavelId, setProcessandoResponsavelId] = useState<
    number | null
  >(null);

  const { documento, isLoading, mensagemErro, mutate } =
    useDocumentoLegalizacao(documentoId);
  const {
    evidencias,
    isLoading: carregandoEvidencias,
    mensagemErro: erroEvidencias,
    mutate: mutateEvidencias,
  } = useEvidenciasLegalizacao(aberto ? documentoId : null);
  const {
    historico,
    isLoading: carregandoHistorico,
    mensagemErro: erroHistorico,
    mutate: mutateHistorico,
  } = useHistoricoLegalizacao(aberto ? documentoId : null);
  // Mesma lista (e mesma chave SWR) do modal de renovação: anexar ali já
  // atualiza a aba Protocolo.
  const {
    processos,
    isLoading: carregandoProcessos,
    mensagemErro: erroProcessos,
  } = useProcessosRenovacao(aberto ? documentoId : null);
  const { atualizar, isLoading: salvandoNaoAplicavel } =
    useAtualizarDocumentoLegalizacao();
  const { reverter, isLoading: revertendo } =
    useReverterDocumentoLegalizacao();
  const { excluir, isLoading: excluindo } = useExcluirDocumentoLegalizacao();
  const { user, isSetorLeg, isCoordenacaoUnidade } = useAuth();
  const { adicionar: adicionarResponsavel } = useAdicionarResponsavelLegalizacao(
    documentoId ?? 0,
  );
  const { remover: removerResponsavel } = useRemoverResponsavelLegalizacao(
    documentoId ?? 0,
  );
  // Só busca candidatos quando a edição está de fato aberta -- não faz
  // sentido gastar a chamada toda vez que o modal abre se ninguém for
  // mexer em responsável.
  const {
    candidatos: candidatosResponsavel,
    isLoading: carregandoCandidatos,
    mensagemErro: erroCandidatos,
    tentarNovamente: tentarNovamenteCandidatos,
  } = useCandidatosResponsaveis(
    mostrandoEdicaoResponsaveis ? documento?.unidade.id : undefined,
    mostrandoEdicaoResponsaveis ? documento?.tipo_documento.id : undefined,
  );

  function fechar() {
    setMostrandoJustificativa(false);
    setJustificativa("");
    setMostrandoHistoricoEvidencias(false);
    setMostrandoProcessoRenovacao(false);
    setMostrandoMovimentacaoProfissional(false);
    setMostrandoConfirmarReversao(false);
    setMostrandoConfirmarExclusao(false);
    setMostrandoEdicao(false);
    setMostrandoNovaVersaoRegra(false);
    setMostrandoEdicaoResponsaveis(false);
    setBuscaResponsavel("");
    onOpenChange(false);
  }

  function aoSalvarEdicao() {
    setMostrandoEdicao(false);
    void mutate().catch(() => {});
    // Mesmo achado de confirmarNaoAplicavel/reverterParaAplicavel acima: a
    // aba Histórico não invalida sozinha, sem isto o registro só aparecia
    // depois de fechar e reabrir o modal.
    void mutateHistorico().catch(() => {});
  }

  // STC-518. `principal`: só True quando este é o 1º responsável de
  // verdade -- um 2º+ com principal implícito (True é o default do model)
  // colide com a constraint de "só 1 principal por documento" no backend
  // e vira 400. Trava só este usuário (processandoResponsavelId) durante
  // a chamada, e revalida o documento em si (não só a lista) porque é o
  // que a sidebar deste modal lê.
  async function aoAdicionarResponsavel(usuarioId: number) {
    if (!documento) return;
    setProcessandoResponsavelId(usuarioId);
    try {
      await adicionarResponsavel({
        usuario_id: usuarioId,
        principal: documento.responsaveis.length === 0,
      });
      await mutate();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setProcessandoResponsavelId(null);
    }
  }

  async function aoRemoverResponsavel(usuarioId: number) {
    setProcessandoResponsavelId(usuarioId);
    try {
      await removerResponsavel(usuarioId);
      await mutate();
    } catch (erro) {
      // Ex.: "Não é possível remover o único responsável principal" --
      // erro real e esperado (backend), não um bug -- mensagem já vem
      // legível de extrairMensagemErro.
      toast.error(extrairMensagemErro(erro));
    } finally {
      setProcessandoResponsavelId(null);
    }
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
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
      return;
    }
    // PATCH já teve sucesso a partir daqui -- uma falha na revalidação
    // abaixo não é erro da ação em si (achado em code review: reportar
    // como erro aqui confundia o usuário sobre algo que já foi salvo). O
    // próximo poll (60s) ou reabrir o modal corrige a UI de qualquer jeito.
    toast.success("Documento marcado como Não aplicável.");
    setMostrandoJustificativa(false);
    setJustificativa("");
    void mutate().catch(() => {});
    // A mudança de status também grava HistoricoRegulatorio (achado em code
    // review: a aba Histórico não tinha nenhuma invalidação própria, só o
    // documento em si) -- sem isto, o registro dessa ação só aparecia depois
    // de fechar e reabrir o modal.
    void mutateHistorico().catch(() => {});
  }

  async function reverterParaAplicavel() {
    if (!documento) return;
    // Mesmo padrão de AnexoList.tsx (ConfirmDialog/AlertDialogAction fecha
    // sozinho ao clicar, então o estado precisa fechar junto em qualquer
    // desfecho, não só sucesso).
    try {
      await reverter({ id: documento.id });
      toast.success("Documento revertido para aplicável.");
      void mutate().catch(() => {});
      void mutateHistorico().catch(() => {});
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setMostrandoConfirmarReversao(false);
    }
  }

  async function excluirDocumento() {
    if (!documento) return;
    try {
      const { jaExcluido } = await excluir({ id: documento.id });
      if (jaExcluido) {
        toast.info("Este documento já tinha sido excluído.");
      } else {
        toast.success("Documento excluído.");
      }
      fechar();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setMostrandoConfirmarExclusao(false);
    }
  }

  const prazo = documento ? prazoDocumento(documento) : null;
  // STC-518: mostra TODOS os responsáveis (antes só o principal, via
  // responsavelPrincipal() -- ver histórico do arquivo) -- múltiplos
  // responsáveis é possível desde a STC-516, e a edição abaixo precisa
  // deles todos pra remover qualquer um, não só o principal.
  const idsResponsaveis = documento
    ? documento.responsaveis.map((r) => r.usuario.id)
    : [];
  const candidatosParaAdicionar = candidatosResponsavel.filter(
    (usuario) => !idsResponsaveis.includes(usuario.id),
  );
  const candidatosFiltrados = candidatosParaAdicionar.filter((usuario) =>
    nomeExibicao(usuario).toLowerCase().includes(buscaResponsavel.trim().toLowerCase()),
  );
  // documento.evidencia_vigente (não evidencia.vigente) é a fonte de
  // verdade -- é o mesmo FK denormalizado que a Matriz de Conformidade usa
  // pra listar a evidência atual sem N+1 (legalizacao/models.py, backend),
  // sincronizado atomicamente com o flag por-evidência no único caminho de
  // escrita que existe (upload). Usar o FK evita depender de mais uma
  // fonte (a flag em cada item) pra achar o mesmo dado.
  const evidenciaVigente = evidencias.find(
    (evidencia) => evidencia.id === documento?.evidencia_vigente,
  );
  const processosComComprovante = processos.filter(
    (processo) => processo.comprovantes_protocolo.length > 0,
  );
  const totalComprovantes = processosComComprovante.reduce(
    (total, processo) => total + processo.comprovantes_protocolo.length,
    0,
  );
  const evidenciasExibidas = mostrandoHistoricoEvidencias
    ? evidencias
    : evidenciaVigente
      ? [evidenciaVigente]
      : [];
  // Mesmo gating dos outros dois botões do grupo (podeRegistrarRenovacao/
  // podeMarcarNaoAplicavel) -- o backend rejeita movimentação profissional
  // nesses dois status (STATUS_CORINGA_COM_JUSTIFICATIVA, legalizacao/
  // views.py): documento já declarado como não aplicável a esta unidade.
  const mostraMovimentacaoProfissional =
    documento &&
    documento.status !== "nao_aplicavel" &&
    documento.status !== "unidade_encerramento"
      ? CODIGOS_MOVIMENTACAO_PROFISSIONAL.has(documento.tipo_documento.codigo)
      : false;
  // Em andamento/Protocolado já são um processo de renovação em curso
  // (Plano de Ação §7: "Em andamento (solicitação iniciada) → Protocolado
  // → Renovação concluída → volta pra Regular") -- "Registrar renovação"
  // começa um processo NOVO, não faz sentido nesses dois estados. O
  // acompanhamento do processo já existente é a STC-381 (ainda não existe).
  const processoJaEmCurso =
    documento?.status === "em_andamento" || documento?.status === "protocolado";
  // Também para os tipos rastreados por movimentação de profissional (CNES,
  // Dosimetria, CREMERJ, COREN): a Legalização renova esses documentos sem
  // que ninguém entre ou saia (STC-796). Os dois caminhos convivem: uma
  // entrada de profissional com processo já aberto reaproveita o mesmo
  // processo (DocumentoUnidadeViewSet.movimentacao_profissional, backend).
  const podeRegistrarRenovacao =
    documento &&
    !processoJaEmCurso &&
    documento.status !== "nao_aplicavel" &&
    documento.status !== "unidade_encerramento";
  // STC-430 (backend): reverter só é aceito a partir desses dois status.
  const podeReverter =
    documento?.status === "nao_aplicavel" ||
    documento?.status === "unidade_encerramento";
  // Achado em análise própria de falhas críticas (STC-434): antes do
  // Reverter existir, oferecer "Marcar como Não aplicável" a partir de
  // Unidade em encerramento já era uma transição válida (STATUS_CORINGA_
  // COM_JUSTIFICATIVA, backend), só não tinha um botão oposto na mesma
  // tela pra conflitar visualmente. Excluir sempre que podeReverter (nao_
  // aplicavel OU unidade_encerramento) evita as duas ações opostas
  // aparecerem juntas.
  const podeMarcarNaoAplicavel = documento && !podeReverter;
  // STC-702/STC-703: excluir só pelo perfil, mesma regra do backend (a
  // permissão individual de "editar" não libera excluir): Admin, Setor de
  // Legalização e Coordenação nos documentos da própria unidade.
  const podeExcluir =
    !!documento &&
    // Admin, só na rede que administra (STC-762).
    (administra(user, documento.unidade.rede) ||
      isSetorLeg ||
      (isCoordenacaoUnidade && user?.unidade_id === documento.unidade.id));
  const nomeDocumento = documento
    ? `${documento.tipo_documento.nome}${documento.profissional ? ` — ${documento.profissional}` : ""}`
    : "";
  // Enquanto as evidências carregam (ou se falharem), sem número: "0
  // evidências" num documento que tem evidência seria falso.
  const textoEvidencias =
    carregandoEvidencias || erroEvidencias
      ? "as evidências"
      : `${evidencias.length} ${evidencias.length === 1 ? "evidência" : "evidências"}`;

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
                  {/* Achado no code review automático (STC-432): tipo
                      controlado_por_profissional (Dosimetria) pode ter
                      várias linhas do mesmo tipo+unidade, uma por
                      profissional -- sem o nome aqui, abrir qualquer uma
                      delas na Lista mostrava o mesmo título, sem diferenciar
                      qual documento está aberto. Mesmo formato de
                      MatrizTable.tsx ("Tipo — Profissional"). */}
                  {documento.tipo_documento.nome}
                  {documento.profissional && ` — ${documento.profissional}`}
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
                  {mostrandoEdicaoResponsaveis ? (
                    <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
                          Responsável operacional
                        </span>
                        <button
                          type="button"
                          onClick={() => setMostrandoEdicaoResponsaveis(false)}
                          className="text-[12.5px] font-medium text-secondary hover:underline"
                        >
                          Concluir
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {documento.responsaveis.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            Sem responsável
                          </span>
                        ) : (
                          documento.responsaveis.map((resp) => (
                            <span
                              key={resp.id}
                              className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                            >
                              {nomeExibicao(resp.usuario)}
                              {resp.principal && (
                                <span className="text-[10px] text-muted-foreground">
                                  (principal)
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => void aoRemoverResponsavel(resp.usuario.id)}
                                // STC-518 (achado em revisão de falhas críticas):
                                // trava TODOS os botões (não só o deste usuário)
                                // enquanto qualquer adição/remoção está em voo --
                                // sem isso, dois cliques rápidos em candidatos
                                // diferentes (documento com 0 responsáveis) liam
                                // `documento.responsaveis.length === 0` desatualizado
                                // nos dois e mandavam `principal: true` duas
                                // vezes, colidindo com a constraint do backend.
                                disabled={processandoResponsavelId !== null}
                                aria-label={`Remover responsável ${nomeExibicao(resp.usuario)}`}
                                className="opacity-70 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      <Popover
                        onOpenChange={(aberto) => {
                          if (!aberto) setBuscaResponsavel("");
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex h-8 w-full items-center justify-center gap-1 rounded-md border border-dashed border-input text-xs font-medium text-muted-foreground hover:border-secondary hover:text-secondary"
                          >
                            + Adicionar responsável
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-72 p-1.5">
                          <Input
                            value={buscaResponsavel}
                            onChange={(evento) => setBuscaResponsavel(evento.target.value)}
                            placeholder="Buscar por nome..."
                            className="mb-1.5 h-7 text-xs"
                            autoFocus
                          />
                          <div className="scrollbar-discreta max-h-48 overflow-y-auto">
                            {carregandoCandidatos ? (
                              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                Carregando...
                              </p>
                            ) : erroCandidatos ? (
                              <div className="flex flex-col items-start gap-1 px-2 py-1.5">
                                <p className="text-xs text-destructive">{erroCandidatos}</p>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={tentarNovamenteCandidatos}
                                >
                                  Tentar novamente
                                </Button>
                              </div>
                            ) : candidatosFiltrados.length === 0 ? (
                              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                Nenhum candidato disponível pra unidade/tipo deste documento.
                              </p>
                            ) : (
                              candidatosFiltrados.map((usuario) => (
                                <button
                                  key={usuario.id}
                                  type="button"
                                  onClick={() => void aoAdicionarResponsavel(usuario.id)}
                                  disabled={processandoResponsavelId !== null}
                                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {nomeExibicao(usuario)}
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : (
                    <CampoMeta rotulo="Responsável operacional">
                      <div className="flex flex-1 flex-wrap items-center gap-1.5">
                        {documento.responsaveis.length === 0 ? (
                          <span className="text-muted-foreground">Sem responsável</span>
                        ) : (
                          documento.responsaveis.map((resp) => (
                            <span key={resp.id} className="flex items-center gap-1">
                              <AvatarUsuario
                                imagem={resp.usuario.foto_url}
                                iniciais={iniciaisDe(nomeExibicao(resp.usuario))}
                                className="size-5 bg-secondary text-[9px] font-bold text-secondary-foreground"
                              />
                              {nomeExibicao(resp.usuario)}
                            </span>
                          ))
                        )}
                        <button
                          type="button"
                          onClick={() => setMostrandoEdicaoResponsaveis(true)}
                          aria-label="Editar responsável operacional"
                          className="ml-1 flex items-center gap-1 text-[12.5px] font-medium text-secondary hover:underline"
                        >
                          <Pencil className="size-3" />
                          Editar
                        </button>
                      </div>
                    </CampoMeta>
                  )}

                  <div className="h-px bg-border" />

                  {mostrandoEdicao ? (
                    <EditarDocumentoSection
                      documento={documento}
                      ativo
                      aoAbrir={() => {}}
                      aoCancelar={() => setMostrandoEdicao(false)}
                      aoSalvar={aoSalvarEdicao}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-2">
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
                      {/* Achado em análise própria: com o documento em Não
                          aplicável/Unidade em encerramento (podeReverter),
                          o Select do modo de edição parte de "Não iniciado"
                          (fora de STATUS_EDITAVEIS) e o backend rejeita
                          qualquer transição a partir daí que não seja via
                          o botão "Reverter para aplicável" -- esconder
                          evita um caminho sem saída. */}
                      {!podeReverter && (
                        <EditarDocumentoSection
                          documento={documento}
                          ativo={false}
                          aoAbrir={() => {
                            setMostrandoJustificativa(false);
                            setJustificativa("");
                            setMostrandoEdicao(true);
                          }}
                          aoCancelar={() => setMostrandoEdicao(false)}
                          aoSalvar={aoSalvarEdicao}
                        />
                      )}
                    </div>
                  )}
                  <CampoMeta rotulo="Antecedência do alerta">
                    {documento.regra_aplicada
                      ? `${documento.regra_aplicada.antecedencia_dias} dias`
                      : "—"}
                    {/* STC-502: só faz sentido corrigir uma regra que já
                        existe -- sem regra_aplicada não há o que editar
                        (mesmo critério já usado em FormNovaVersaoRegra.tsx,
                        "documento.regra_aplicada ? ... : 'nada a corrigir'"). */}
                    {documento.regra_aplicada && (
                      <button
                        type="button"
                        onClick={() => setMostrandoNovaVersaoRegra(true)}
                        aria-label="Editar antecedência do alerta"
                        className="ml-1 flex items-center gap-1 text-[12.5px] font-medium text-secondary hover:underline"
                      >
                        <Pencil className="size-3" />
                        Editar
                      </button>
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
                  ) : mostrandoEdicao ? null : (
                    <div className="flex flex-col gap-2">
                      {processoJaEmCurso && (
                        <Button
                          variant="outline"
                          onClick={() => setMostrandoProcessoRenovacao(true)}
                        >
                          Acompanhar Renovação
                        </Button>
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
                          onClick={() => {
                            setMostrandoEdicao(false);
                            setMostrandoJustificativa(true);
                          }}
                        >
                          Marcar como Não aplicável
                        </Button>
                      )}
                      {podeReverter && (
                        <Button
                          variant="outline"
                          onClick={() => setMostrandoConfirmarReversao(true)}
                        >
                          Reverter para aplicável
                        </Button>
                      )}
                      {mostraMovimentacaoProfissional && (
                        <Button
                          variant="outline"
                          className="border-red-600/40 text-red-700 hover:bg-red-600/5 hover:text-red-700"
                          onClick={() =>
                            setMostrandoMovimentacaoProfissional(true)
                          }
                        >
                          Reportar Movimentação
                        </Button>
                      )}
                      {podeExcluir && (
                        <Button
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                          onClick={() => setMostrandoConfirmarExclusao(true)}
                        >
                          <Trash2 className="size-4" />
                          Excluir documento
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
                  // min-w-0: achado testando com nome de evidência longo --
                  // item de grid (coluna 1fr do grid pai) tem min-width:
                  // auto por padrão, que considera o conteúdo intrínseco de
                  // descendentes (o nome do arquivo sem quebra) e estourava
                  // a coluna inteira, ignorando qualquer truncate interno.
                  className="min-h-0 min-w-0 flex-1 gap-0"
                >
                  {/* Sem ícone e com menos espaço abaixo de sm: as três
                      abas não cabem lado a lado num celular de 360 px. */}
                  <TabsList
                    variant="line"
                    className="h-11 w-full justify-start gap-2 rounded-none border-b border-border bg-transparent px-3 sm:gap-4 sm:px-5"
                  >
                    <TabsTrigger
                      value="evidencias"
                      className="gap-1.5 rounded-none px-1 text-[13px] data-[state=active]:shadow-none"
                    >
                      <FileText className="hidden size-3.5 sm:block" />
                      Evidências
                      <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] font-bold text-muted-foreground">
                        {evidencias.length}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="protocolo"
                      className="gap-1.5 rounded-none px-1 text-[13px] data-[state=active]:shadow-none"
                    >
                      <Paperclip className="hidden size-3.5 sm:block" />
                      Protocolo
                      <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] font-bold text-muted-foreground">
                        {totalComprovantes}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="historico"
                      className="gap-1.5 rounded-none px-1 text-[13px] data-[state=active]:shadow-none"
                    >
                      <HistoryIcon className="hidden size-3.5 sm:block" />
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
                    value="protocolo"
                    className="scrollbar-discreta flex-1 space-y-4 overflow-y-auto p-5"
                  >
                    <p className="text-[11.5px] text-muted-foreground">
                      Documentos de protocolo: comprovam o pedido feito ao
                      órgão.
                    </p>
                    {carregandoProcessos ? (
                      <div className="flex flex-col gap-2.5">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                      </div>
                    ) : erroProcessos ? (
                      <p className="text-sm text-destructive">
                        Não foi possível carregar os documentos de protocolo:{" "}
                        {erroProcessos}
                      </p>
                    ) : processosComComprovante.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum documento de protocolo anexado ainda.
                      </p>
                    ) : (
                      processosComComprovante.map((processo) => (
                        <GrupoComprovantes key={processo.id} processo={processo} />
                      ))
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
        onAtualizado={() => {
          void mutate();
          // Criar/atualizar o processo também grava HistoricoRegulatorio no
          // documento (_sincronizar_documento, legalizacao/views.py) e, ao
          // concluir, envia uma evidência nova -- mesmo motivo de
          // mutate()/mutateHistorico() acima, estendido pra evidências
          // (STC-381).
          void mutateHistorico().catch(() => {});
          void mutateEvidencias().catch(() => {});
        }}
      />
      <MovimentacaoProfissionalModal
        documento={documento ?? null}
        aberto={mostrandoMovimentacaoProfissional}
        onOpenChange={setMostrandoMovimentacaoProfissional}
        onAtualizado={() => {
          // Reportar movimentação também pode mudar OUTROS documentos da
          // mesma unidade (checklist), não só este -- cada um já invalida a
          // própria chave em useReportarMovimentacaoProfissional; aqui só
          // garante que ESTE modal (o documento que abriu a ação) refaz
          // fetch mesmo que ele próprio não estivesse marcado no checklist.
          void mutate();
          void mutateHistorico().catch(() => {});
        }}
        onEntradaConcluida={() => setMostrandoProcessoRenovacao(true)}
      />
      {documento && (
        <DialogNovaVersao
          documento={documento}
          open={mostrandoNovaVersaoRegra}
          onOpenChange={setMostrandoNovaVersaoRegra}
          onAtualizado={() => {
            void mutate();
            void mutateHistorico().catch(() => {});
          }}
        />
      )}
      <ConfirmDialog
        open={mostrandoConfirmarReversao}
        onOpenChange={setMostrandoConfirmarReversao}
        titulo="Reverter para aplicável"
        descricao="O documento volta a ser aplicável a esta unidade. O status é recalculado pela validade já registrada (sem validade vira Não iniciado, validade vencida vira Vencido, validade futura vira Regular)."
        textoConfirmar="Reverter"
        isLoading={revertendo}
        onConfirmar={() => void reverterParaAplicavel()}
      />
      <ConfirmDialog
        open={mostrandoConfirmarExclusao}
        onOpenChange={setMostrandoConfirmarExclusao}
        titulo="Excluir documento"
        descricao={
          <>
            O documento <strong className="text-foreground">{nomeDocumento}</strong>{" "}
            da unidade{" "}
            <strong className="text-foreground">{documento?.unidade.nome}</strong> será
            excluído, com {textoEvidencias}, o histórico e, se houver, o processo de renovação e o card no Kanban. Essa ação não pode ser
            desfeita.
          </>
        }
        textoConfirmar="Excluir"
        destrutivo
        isLoading={excluindo}
        onConfirmar={() => void excluirDocumento()}
      />
    </>
  );
}
