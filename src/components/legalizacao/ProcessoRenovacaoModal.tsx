"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useEnviarEvidenciaLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import {
  useAtualizarProcessoRenovacao,
  useCriarProcessoRenovacao,
  useProcessosRenovacao,
} from "@/hooks/useProcessoRenovacao";
import { extrairMensagemErro } from "@/lib/erros";
import { cn, nomeExibicao } from "@/lib/utils";
import type {
  DocumentoUnidade,
  ProcessoRenovacao,
  StatusProcessoRenovacao,
} from "@/types/legalizacao";

// Mesma whitelist de FormCadastrarDocumento.tsx (Administração) -- mesmos
// tipos de arquivo aceitos em todo o módulo.
const ACCEPT_EVIDENCIA = ".pdf,.doc,.docx,.pptx,.xlsx,.png,.jpg,.jpeg";

// Exportado -- reaproveitado no Histórico do documento (DetalheDocumentoModal.tsx)
// pra traduzir o valor cru de HistoricoRegulatorio quando acao=="processo_status".
export const LABEL_STATUS_PROCESSO: Record<StatusProcessoRenovacao, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  protocolado: "Protocolado",
  concluido: "Concluído",
};

// created_at é datetime UTC completo -- fatiar a string crua ("YYYY-MM-DD"
// dos 10 primeiros caracteres) mostraria o dia errado pra quem estiver num
// fuso atrás de UTC durante a virada (achado em análise de falhas
// críticas). new Date(iso) + Intl já convertem pro fuso do navegador,
// mesmo princípio de formatarDataHora (@/lib/utils).
const FORMATADOR_DATA_LOCAL = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
function formatarDataDeDatetime(iso: string) {
  return FORMATADOR_DATA_LOCAL.format(new Date(iso));
}

// Mesmo padrão de CampoMeta (DetalheDocumentoModal.tsx) -- rótulo pequeno em
// caixa alta acima do valor.
function CampoSomenteLeitura({
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
      <span className="text-[13.5px] font-medium text-foreground">
        {children}
      </span>
    </div>
  );
}

function TituloSecao({
  numero,
  titulo,
  concluida,
}: {
  numero: number;
  titulo: string;
  concluida?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-[11px] font-extrabold tracking-wide uppercase",
        concluida ? "text-muted-foreground" : "text-secondary",
      )}
    >
      {numero}. {titulo}
      {concluida && " · concluída"}
    </span>
  );
}

// Seções 2 (Protocolo) e 3 (Conclusão), STC-381 -- operam sobre um
// ProcessoRenovacao JÁ existente. `key={processo.id}` no componente pai
// garante que este componente remonta (e reinicializa o state local a
// partir de `processo`) sempre que o processo ativo muda -- evita
// sincronizar via useEffect.
function FormularioProcessoAtivo({
  documento,
  processo,
  onFechar,
  onAtualizado,
}: {
  documento: DocumentoUnidade;
  processo: ProcessoRenovacao;
  onFechar: () => void;
  onAtualizado: () => void;
}) {
  const { atualizar, isLoading: salvando } = useAtualizarProcessoRenovacao();
  const { enviar: enviarEvidencia, isLoading: enviandoEvidencia } =
    useEnviarEvidenciaLegalizacao(documento.id);

  const [protocoloNumero, setProtocoloNumero] = useState(
    processo.protocolo_numero,
  );
  const [protocoloOrgao, setProtocoloOrgao] = useState(
    processo.protocolo_orgao,
  );
  const [protocoloData, setProtocoloData] = useState(
    processo.protocolo_data ?? "",
  );
  const [observacoes, setObservacoes] = useState(processo.observacoes);
  const [novaValidade, setNovaValidade] = useState("");
  const [arquivoEvidencia, setArquivoEvidencia] = useState<File | null>(null);
  const [evidenciaJaEnviada, setEvidenciaJaEnviada] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  async function salvarProtocolo() {
    if (!protocoloNumero.trim()) return;
    try {
      await atualizar({
        id: processo.id,
        payload: {
          status: "protocolado",
          protocolo_numero: protocoloNumero.trim(),
          protocolo_orgao: protocoloOrgao.trim(),
          protocolo_data: protocoloData || null,
          observacoes: observacoes.trim(),
        },
      });
      toast.success("Protocolo salvo.");
      onAtualizado();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function concluirRenovacao() {
    if (!novaValidade || !arquivoEvidencia) return;
    try {
      // Acha 1º, conclui depois: uma vez concluído, o processo deixa de ser
      // "ativo" (documento.processos.exclude(status=CONCLUIDO)) -- se a
      // ordem fosse invertida, a evidência enviada em seguida subiria sem
      // vínculo nenhum com o processo (achado lendo legalizacao/views.py,
      // action evidencias()).
      if (!evidenciaJaEnviada) {
        await enviarEvidencia(arquivoEvidencia);
        setEvidenciaJaEnviada(true);
      }
      await atualizar({
        id: processo.id,
        payload: {
          status: "concluido",
          nova_validade: novaValidade,
          // Achado em análise de falhas críticas: sem reenviar os campos
          // de protocolo aqui, editar Número/Órgão/Observações e clicar
          // direto em "Concluir renovação" (sem passar por "Salvar
          // protocolo" antes) descartava essas edições em silêncio.
          protocolo_numero: protocoloNumero.trim(),
          protocolo_orgao: protocoloOrgao.trim(),
          protocolo_data: protocoloData || null,
          observacoes: observacoes.trim(),
        },
      });
      toast.success("Renovação concluída.");
      onAtualizado();
      onFechar();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <>
      <div className="scrollbar-discreta flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3.5">
          <TituloSecao numero={1} titulo="Solicitação" concluida />
          <div className="grid grid-cols-2 gap-3">
            <CampoSomenteLeitura rotulo="Data da solicitação">
              {formatarDataDeDatetime(processo.created_at)}
            </CampoSomenteLeitura>
            <CampoSomenteLeitura rotulo="Aberto por">
              {processo.usuario_responsavel
                ? nomeExibicao(processo.usuario_responsavel)
                : "—"}
            </CampoSomenteLeitura>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
          <TituloSecao
            numero={2}
            titulo="Protocolo"
            concluida={processo.status !== "em_andamento"}
          />
          <p className="-mt-1 text-[11.5px] text-muted-foreground">
            Opcional, preencha só se houver órgão envolvido.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rn-protocolo-numero" className="text-xs">
                Número do protocolo
              </Label>
              <Input
                id="rn-protocolo-numero"
                value={protocoloNumero}
                onChange={(evento) => setProtocoloNumero(evento.target.value)}
                placeholder="Ex: 2026/00184-LIC"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rn-protocolo-orgao" className="text-xs">
                Órgão
              </Label>
              <Input
                id="rn-protocolo-orgao"
                value={protocoloOrgao}
                onChange={(evento) => setProtocoloOrgao(evento.target.value)}
                placeholder="Ex: Prefeitura de Niterói"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rn-protocolo-data" className="text-xs">
                Data do protocolo
              </Label>
              <Input
                id="rn-protocolo-data"
                type="date"
                value={protocoloData}
                onChange={(evento) => setProtocoloData(evento.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rn-observacoes" className="text-xs">
              Observações
            </Label>
            <Textarea
              id="rn-observacoes"
              rows={2}
              value={observacoes}
              onChange={(evento) => setObservacoes(evento.target.value)}
              placeholder="Anotações internas sobre o andamento do protocolo..."
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={!protocoloNumero.trim() || salvando}
            onClick={() => void salvarProtocolo()}
          >
            {salvando ? "Salvando..." : "Salvar protocolo"}
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
          <TituloSecao numero={3} titulo="Conclusão" />
          <p className="-mt-1 text-[11.5px] text-muted-foreground">
            Disponível a qualquer momento, com ou sem protocolo.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rn-nova-validade" className="text-xs">
              Nova validade <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rn-nova-validade"
              type="date"
              value={novaValidade}
              onChange={(evento) => setNovaValidade(evento.target.value)}
              className="max-w-[200px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">
              Evidência (documento renovado){" "}
              <span className="text-destructive">*</span>
            </Label>
            <input
              ref={inputArquivoRef}
              type="file"
              accept={ACCEPT_EVIDENCIA}
              className="hidden"
              onChange={(evento) => {
                setArquivoEvidencia(evento.target.files?.[0] ?? null);
                setEvidenciaJaEnviada(false);
              }}
            />
            {arquivoEvidencia ? (
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {arquivoEvidencia.name}
                </span>
                <button
                  type="button"
                  aria-label={`Remover ${arquivoEvidencia.name}`}
                  onClick={() => {
                    setArquivoEvidencia(null);
                    setEvidenciaJaEnviada(false);
                    if (inputArquivoRef.current)
                      inputArquivoRef.current.value = "";
                  }}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputArquivoRef.current?.click()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-md border-1.5 border-dashed border-border text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-secondary hover:text-secondary"
              >
                <Plus className="size-3.5" />
                Enviar evidência
              </button>
            )}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onFechar}
          disabled={salvando || enviandoEvidencia}
        >
          Cancelar
        </Button>
        <Button
          disabled={
            !novaValidade || !arquivoEvidencia || salvando || enviandoEvidencia
          }
          onClick={() => void concluirRenovacao()}
        >
          {salvando || enviandoEvidencia
            ? "Concluindo..."
            : "Concluir renovação"}
        </Button>
      </DialogFooter>
    </>
  );
}

// Ponto de entrada da STC-381 (mockup_processo_renovacao_legalizacao.html) --
// "Registrar renovação" (Detalhe do Documento, STC-380) abre este modal em
// vez de criar o processo direto no clique. Sem processo ativo ainda: passo
// de confirmação, cria o processo. Com processo ativo (em_andamento ou
// protocolado): as 3 seções reais (Solicitação/Protocolo/Conclusão).
export function ProcessoRenovacaoModal({
  documento,
  aberto,
  onOpenChange,
  onAtualizado,
}: {
  documento: DocumentoUnidade | null;
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
  onAtualizado: () => void;
}) {
  const { user } = useAuth();
  const {
    processoAtivo,
    isLoading: carregandoProcesso,
    mutate: mutateProcessos,
  } = useProcessosRenovacao(aberto ? (documento?.id ?? null) : null);
  const { criar, isLoading: criando } = useCriarProcessoRenovacao();

  function fechar() {
    onOpenChange(false);
  }

  async function iniciarProcesso() {
    if (!documento) return;
    try {
      const processo = await criar({
        documento_unidade: documento.id,
        usuario_responsavel: user?.usuarioId ?? null,
      });
      // Atualiza o cache local direto com a resposta do POST (sem esperar
      // uma revalidação de rede) -- sem isto, o modal ficava um instante
      // ainda mostrando o passo de confirmação até o refetch chegar.
      await mutateProcessos((atual) => [processo, ...(atual ?? [])], {
        revalidate: false,
      });
      onAtualizado();
      toast.success("Processo de renovação iniciado.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Processo de Renovação</DialogTitle>
          {documento && (
            <p className="text-[12.5px] text-muted-foreground">
              {documento.tipo_documento.nome} · {documento.unidade.nome}
              {processoAtivo &&
                ` · ${LABEL_STATUS_PROCESSO[processoAtivo.status]}`}
            </p>
          )}
        </DialogHeader>

        {carregandoProcesso ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : processoAtivo && documento ? (
          <FormularioProcessoAtivo
            key={processoAtivo.id}
            documento={documento}
            processo={processoAtivo}
            onFechar={fechar}
            onAtualizado={onAtualizado}
          />
        ) : (
          <>
            <p className="text-sm text-foreground">
              Isso inicia o processo de renovação e move o documento para
              &quot;Em andamento&quot;.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={fechar} disabled={criando}>
                Cancelar
              </Button>
              <Button disabled={criando} onClick={() => void iniciarProcesso()}>
                {criando ? "Iniciando..." : "Iniciar processo de renovação"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
