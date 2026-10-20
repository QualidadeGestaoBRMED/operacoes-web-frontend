"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { useAcoesDoLote, useLoteRenovacao } from "@/hooks/useLoteRenovacao";
import { extrairMensagemErro } from "@/lib/erros";
import { LABEL_STATUS } from "@/lib/legalizacaoMatriz";
import { formatarDataDeDatetime, LABEL_STATUS_PROCESSO } from "@/lib/legalizacaoRenovacao";
import { cn } from "@/lib/utils";
import type { DocumentoUnidade, ItemDoLote, LoteRenovacao } from "@/types/legalizacao";
import { CampoSomenteLeitura, TituloSecao } from "./ProcessoRenovacaoModal";

// Renovação em lote (STC-779, backend STC-778): instâncias do mesmo tipo e da
// mesma clínica renovadas juntas, cada uma com o próprio processo, e um card
// só no Kanban. Sem lote ainda: escolher as instâncias. Com lote: as mesmas
// seções do modal de renovação (ProcessoRenovacaoModal), uma vez para todos.

const ACCEPT_PDF = ".pdf";
const MINIMO_DE_ITENS = 2;

// Documento que não pode entrar num lote agora: já em renovação, ou declarado
// fora de uso nesta clínica (o backend recusa a transição).
function motivoParaFicarDeFora(documento: DocumentoUnidade): string | null {
  if (documento.status === "em_andamento" || documento.status === "protocolado") {
    return "em renovação";
  }
  if (documento.status === "nao_aplicavel" || documento.status === "unidade_encerramento") {
    return LABEL_STATUS[documento.status].toLowerCase();
  }
  return null;
}

function rotuloDoItem(identificador: string) {
  return identificador || "Sem identificador";
}

/** Escolha das instâncias e início do lote. */
function PassoSelecao({
  documentoInicial,
  onCriado,
  onCancelar,
}: {
  documentoInicial: DocumentoUnidade;
  onCriado: (lote: LoteRenovacao) => void;
  onCancelar: () => void;
}) {
  const { user } = useAuth();
  const { iniciar, emAndamento } = useAcoesDoLote();
  const { documentos, isLoading, mensagemErro } = useDocumentosLegalizacao({
    unidade: documentoInicial.unidade.id,
    tipo_documento: documentoInicial.tipo_documento.id,
  });
  const [marcados, setMarcados] = useState<Set<number>>(
    () => new Set(motivoParaFicarDeFora(documentoInicial) ? [] : [documentoInicial.id]),
  );
  const [dataSolicitacao, setDataSolicitacao] = useState("");
  const instancias = [...documentos].sort((a, b) =>
    (a.profissional || "").localeCompare(b.profissional || "", "pt-BR"),
  );
  const iniciando = emAndamento === "iniciar";

  function alternar(id: number) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function iniciarLote() {
    try {
      const lote = await iniciar({
        documentos: [...marcados],
        data_solicitacao: dataSolicitacao || null,
        usuario_responsavel: user?.usuarioId ?? null,
      });
      toast.success(`Renovação em lote iniciada com ${lote.itens.length} itens.`);
      onCriado(lote);
    } catch (erro) {
      // A seleção e a data ficam como estão para tentar de novo.
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <>
      <div className="scrollbar-discreta flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1">
        <p className="text-[12.5px] text-muted-foreground">
          Marque as instâncias que serão renovadas juntas. Cada uma mantém a própria validade,
          histórico e certificado.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando instâncias...</p>
        ) : mensagemErro ? (
          <p className="text-sm text-destructive">{mensagemErro}</p>
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label="Instâncias">
            {instancias.map((documento) => {
              const motivo = motivoParaFicarDeFora(documento);
              return (
                <li key={documento.id}>
                  <label
                    className={cn(
                      "flex items-center gap-2.5 rounded-md bg-muted px-3 py-2 text-[13px]",
                      motivo ? "opacity-60" : "cursor-pointer",
                    )}
                  >
                    <Checkbox
                      checked={marcados.has(documento.id)}
                      disabled={Boolean(motivo) || iniciando}
                      onCheckedChange={() => alternar(documento.id)}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {rotuloDoItem(documento.profissional)}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">
                      {motivo ?? LABEL_STATUS[documento.status]}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex max-w-[220px] flex-col gap-1.5">
          <Label htmlFor="lote-data-solicitacao" className="text-xs">
            Data da solicitação
          </Label>
          <Input
            id="lote-data-solicitacao"
            type="date"
            value={dataSolicitacao}
            onChange={(evento) => setDataSolicitacao(evento.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancelar} disabled={iniciando}>
          Cancelar
        </Button>
        <Button
          disabled={marcados.size < MINIMO_DE_ITENS || iniciando}
          onClick={() => void iniciarLote()}
        >
          {iniciando ? "Iniciando..." : `Iniciar lote com ${marcados.size} itens`}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Botão que abre o seletor de PDF e envia na hora. */
function BotaoPdf({
  rotulo,
  rotuloAcessivel,
  enviando,
  desabilitado,
  onArquivo,
}: {
  rotulo: string;
  rotuloAcessivel: string;
  enviando: boolean;
  desabilitado: boolean;
  onArquivo: (arquivo: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_PDF}
        aria-label={rotuloAcessivel}
        className="hidden"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          if (!arquivo) return;
          void onArquivo(arquivo).finally(() => {
            if (input.current) input.current.value = "";
          });
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={desabilitado || enviando}
        onClick={() => input.current?.click()}
      >
        <Plus aria-hidden className="size-3.5" />
        {enviando ? "Enviando..." : rotulo}
      </Button>
    </>
  );
}

/** O lote já criado: itens, protocolo e conclusão. */
function FormularioDoLote({
  lote,
  onLoteSaiu,
}: {
  lote: LoteRenovacao;
  onLoteSaiu: () => void;
}) {
  const acoes = useAcoesDoLote();
  const ocupado = acoes.emAndamento !== null;
  const abertos = lote.itens.filter((item) => item.status !== "concluido");

  const [protocoloNumero, setProtocoloNumero] = useState(lote.protocolo_numero);
  const [protocoloOrgao, setProtocoloOrgao] = useState(lote.protocolo_orgao);
  const [protocoloData, setProtocoloData] = useState(lote.protocolo_data ?? "");
  const [observacoes, setObservacoes] = useState(lote.observacoes);
  const [comprovanteEnviado, setComprovanteEnviado] = useState<string | null>(null);

  const [modoCertificado, setModoCertificado] = useState<"unico" | "por_item">("unico");
  const [validadeComum, setValidadeComum] = useState("");
  // Validade ajustada de um item; sem ajuste, vale a comum.
  const [validadePorItem, setValidadePorItem] = useState<Record<number, string>>({});
  // Itens fora da conclusão desta vez (os demais abertos entram).
  const [foraDaConclusao, setForaDaConclusao] = useState<Set<number>>(new Set());

  const aConcluir = abertos.filter((item) => !foraDaConclusao.has(item.id));
  const validadeDe = (item: ItemDoLote) => validadePorItem[item.id] || validadeComum;
  const semCertificado = aConcluir.filter((item) => !item.tem_certificado);
  const semValidade = aConcluir.filter((item) => !validadeDe(item));
  const podeConcluir =
    aConcluir.length > 0 && semCertificado.length === 0 && semValidade.length === 0;

  async function salvarProtocolo() {
    try {
      await acoes.registrarProtocolo(lote.id, {
        protocolo_numero: protocoloNumero.trim(),
        protocolo_orgao: protocoloOrgao.trim(),
        protocolo_data: protocoloData || null,
        observacoes: observacoes.trim(),
      });
      toast.success("Protocolo salvo para o lote.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function anexarComprovante(arquivo: File) {
    try {
      await acoes.enviarComprovante(lote.id, arquivo);
      setComprovanteEnviado(arquivo.name);
      toast.success("Comprovante anexado a todos os itens abertos.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function enviarCertificadoUnico(arquivo: File) {
    try {
      await acoes.enviarCertificadoUnico(lote.id, arquivo);
      toast.success("Certificado anexado a todos os itens abertos.");
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function enviarCertificadoDoItem(item: ItemDoLote, arquivo: File) {
    try {
      await acoes.enviarCertificadoDoItem(lote.id, item.documento.id, arquivo);
      toast.success(`Certificado de ${rotuloDoItem(item.documento.identificador)} anexado.`);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function concluir() {
    try {
      const atualizado = await acoes.concluir(
        lote.id,
        aConcluir.map((item) => ({ processo: item.id, nova_validade: validadeDe(item) })),
      );
      toast.success(
        atualizado.concluido_em
          ? "Renovação em lote concluída."
          : `${aConcluir.length} ${aConcluir.length === 1 ? "item concluído" : "itens concluídos"}.`,
      );
      setForaDaConclusao(new Set());
    } catch (erro) {
      // Validades e seleção ficam como estão para corrigir e tentar de novo.
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function retirar(item: ItemDoLote, manterRenovacao: boolean) {
    try {
      const atualizado = await acoes.retirar(lote.id, item.id, manterRenovacao);
      toast.success(
        manterRenovacao
          ? `${rotuloDoItem(item.documento.identificador)} saiu do lote e segue como renovação à parte.`
          : `${rotuloDoItem(item.documento.identificador)} saiu do lote sem renovação.`,
      );
      if (atualizado === null) onLoteSaiu();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  function alternarConclusao(id: number) {
    setForaDaConclusao((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <div className="scrollbar-discreta flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3.5">
        <TituloSecao numero={1} titulo="Itens" concluida={lote.concluido_em !== null} />
        <div className="grid grid-cols-2 gap-3">
          <CampoSomenteLeitura rotulo="Iniciado em">
            {formatarDataDeDatetime(lote.created_at)}
          </CampoSomenteLeitura>
          <CampoSomenteLeitura rotulo="Progresso">
            {lote.progresso.concluidos} de {lote.progresso.total} concluídos
          </CampoSomenteLeitura>
        </div>
        <ul className="flex flex-col gap-1.5" aria-label="Itens do lote">
          {lote.itens.map((item) => {
            const nome = rotuloDoItem(item.documento.identificador);
            const aberto = item.status !== "concluido";
            return (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-md bg-background px-3 py-2 text-[13px]"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{nome}</span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground">
                  {LABEL_STATUS_PROCESSO[item.status]}
                </span>
                {item.tem_certificado && (
                  <Check
                    className="size-3.5 shrink-0 text-green-700"
                    aria-label={`Com certificado: ${nome}`}
                  />
                )}
                {aberto && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={ocupado}
                        aria-label={`Retirar ${nome} do lote`}
                      >
                        Retirar
                        <ChevronDown aria-hidden className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => void retirar(item, true)}>
                        Seguir com renovação à parte
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={item.tem_certificado}
                        onSelect={() => void retirar(item, false)}
                      >
                        {item.tem_certificado
                          ? "Sem renovação (já tem certificado)"
                          : "Sair sem renovação"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {abertos.length > 0 && (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
            <TituloSecao numero={2} titulo="Protocolo" />
            <p className="-mt-1 text-[11.5px] text-muted-foreground">
              Opcional, uma vez para todos os itens abertos.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lote-protocolo-numero" className="text-xs">
                  Número do protocolo
                </Label>
                <Input
                  id="lote-protocolo-numero"
                  value={protocoloNumero}
                  onChange={(evento) => setProtocoloNumero(evento.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lote-protocolo-orgao" className="text-xs">
                  Órgão
                </Label>
                <Input
                  id="lote-protocolo-orgao"
                  value={protocoloOrgao}
                  onChange={(evento) => setProtocoloOrgao(evento.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lote-protocolo-data" className="text-xs">
                  Data do protocolo
                </Label>
                <Input
                  id="lote-protocolo-data"
                  type="date"
                  value={protocoloData}
                  onChange={(evento) => setProtocoloData(evento.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lote-observacoes" className="text-xs">
                Observações
              </Label>
              <Textarea
                id="lote-observacoes"
                rows={2}
                value={observacoes}
                onChange={(evento) => setObservacoes(evento.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!protocoloNumero.trim() || ocupado}
                onClick={() => void salvarProtocolo()}
              >
                {acoes.emAndamento === "protocolo" ? "Salvando..." : "Salvar protocolo"}
              </Button>
              <BotaoPdf
                rotulo="Anexar comprovante"
                rotuloAcessivel="Arquivo do comprovante de protocolo do lote"
                enviando={acoes.emAndamento === "comprovante"}
                desabilitado={ocupado}
                onArquivo={anexarComprovante}
              />
              {comprovanteEnviado && (
                <span className="text-[11.5px] text-muted-foreground">
                  Anexado: {comprovanteEnviado}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3.5">
            <TituloSecao numero={3} titulo="Conclusão" />
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs font-medium">Certificado</legend>
              {(
                [
                  ["unico", "Um laudo para todos"],
                  ["por_item", "Um PDF por item"],
                ] as const
              ).map(([valor, rotulo]) => (
                <label key={valor} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="radio"
                    name="lote-modo-certificado"
                    value={valor}
                    checked={modoCertificado === valor}
                    onChange={() => setModoCertificado(valor)}
                  />
                  {rotulo}
                </label>
              ))}
            </fieldset>
            {modoCertificado === "unico" && (
              <div>
                <BotaoPdf
                  rotulo="Enviar laudo para todos"
                  rotuloAcessivel="Arquivo do laudo único do lote"
                  enviando={acoes.emAndamento === "certificado"}
                  desabilitado={ocupado}
                  onArquivo={enviarCertificadoUnico}
                />
              </div>
            )}
            <div className="flex max-w-[220px] flex-col gap-1.5">
              <Label htmlFor="lote-validade-comum" className="text-xs">
                Nova validade (para todos)
              </Label>
              <Input
                id="lote-validade-comum"
                type="date"
                value={validadeComum}
                onChange={(evento) => setValidadeComum(evento.target.value)}
              />
            </div>
            <p className="-mb-1 text-[11.5px] text-muted-foreground">
              Validade de um item só se for diferente da comum; em branco, vale a comum.
            </p>
            <ul className="flex flex-col gap-1.5" aria-label="Itens a concluir">
              {abertos.map((item) => {
                const nome = rotuloDoItem(item.documento.identificador);
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-md bg-background px-3 py-2 text-[13px]"
                  >
                    {/* basis-full abaixo de sm: o nome numa linha só dele, com
                        a data e o PDF embaixo; lado a lado, cortaria o nome. */}
                    <label className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
                      <Checkbox
                        checked={!foraDaConclusao.has(item.id)}
                        disabled={ocupado}
                        aria-label={`Concluir ${nome}`}
                        onCheckedChange={() => alternarConclusao(item.id)}
                      />
                      <span className="truncate font-medium">{nome}</span>
                    </label>
                    <Input
                      type="date"
                      aria-label={`Validade de ${nome}`}
                      value={validadePorItem[item.id] ?? ""}
                      onChange={(evento) =>
                        setValidadePorItem((atual) => ({
                          ...atual,
                          [item.id]: evento.target.value,
                        }))
                      }
                      className="h-8 w-[150px]"
                    />
                    {modoCertificado === "por_item" && (
                      <BotaoPdf
                        rotulo={item.tem_certificado ? "Trocar PDF" : "Enviar PDF"}
                        rotuloAcessivel={`Certificado de ${nome}`}
                        enviando={acoes.emAndamento === `certificado-${item.documento.id}`}
                        desabilitado={ocupado}
                        onArquivo={(arquivo) => enviarCertificadoDoItem(item, arquivo)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            {aConcluir.length > 0 && !podeConcluir && (
              <p className="text-[11.5px] text-muted-foreground" role="status">
                {semCertificado.length > 0
                  ? `Falta certificado: ${semCertificado
                      .map((item) => rotuloDoItem(item.documento.identificador))
                      .join(", ")}.`
                  : "Informe a nova validade de todos os itens marcados."}
              </p>
            )}
            <Button
              className="self-start"
              disabled={!podeConcluir || ocupado}
              onClick={() => void concluir()}
            >
              {acoes.emAndamento === "concluir"
                ? "Concluindo..."
                : `Concluir ${aConcluir.length} ${aConcluir.length === 1 ? "item" : "itens"}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Renovação em lote. `loteId`: abre um lote existente (detalhe de uma
 * instância do lote, link `?lote=` do card no Kanban). `documentoInicial`,
 * sem `loteId`: começa pela escolha das instâncias, com esta já marcada.
 */
export function LoteRenovacaoModal({
  aberto,
  onOpenChange,
  loteId,
  documentoInicial,
}: {
  aberto: boolean;
  onOpenChange: (open: boolean) => void;
  loteId: number | null;
  documentoInicial?: DocumentoUnidade | null;
}) {
  // Lote criado aqui mesmo, no passo de seleção.
  const [loteCriadoId, setLoteCriadoId] = useState<number | null>(null);
  // Fechado de qualquer jeito (inclusive por fora, sem passar por fechar()),
  // esquece o lote criado: a próxima abertura começa pela escolha.
  if (!aberto && loteCriadoId !== null) {
    setLoteCriadoId(null);
  }
  const idAtual = loteId ?? loteCriadoId;
  const { lote, isLoading, mensagemErro } = useLoteRenovacao(aberto ? idAtual : null);

  function fechar() {
    setLoteCriadoId(null);
    onOpenChange(false);
  }

  const subtitulo = lote
    ? `${lote.tipo_documento.nome} · ${lote.unidade.nome} · ${lote.progresso.concluidos} de ${lote.progresso.total} concluídos`
    : documentoInicial
      ? `${documentoInicial.tipo_documento.nome} · ${documentoInicial.unidade.nome}`
      : "";

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Renovação em lote</DialogTitle>
          {subtitulo && <p className="text-[12.5px] text-muted-foreground">{subtitulo}</p>}
        </DialogHeader>

        {idAtual === null ? (
          documentoInicial ? (
            <PassoSelecao
              documentoInicial={documentoInicial}
              onCriado={(criado) => setLoteCriadoId(criado.id)}
              onCancelar={fechar}
            />
          ) : null
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando lote...</p>
        ) : mensagemErro || !lote ? (
          <>
            <p className="text-sm text-destructive">
              {mensagemErro ?? "Este lote não existe mais."}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={fechar}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <FormularioDoLote key={lote.id} lote={lote} onLoteSaiu={fechar} />
            <DialogFooter>
              <Button variant="outline" onClick={fechar}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
