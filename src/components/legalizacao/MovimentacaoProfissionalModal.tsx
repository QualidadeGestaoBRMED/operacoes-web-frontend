"use client";

import { useRef, useState } from "react";
import { AlertTriangle, UserPlus, UserX } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentosLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { useReportarMovimentacaoProfissional } from "@/hooks/useMovimentacaoProfissional";
import { extrairMensagemErro } from "@/lib/erros";
import { CODIGOS_MOVIMENTACAO_PROFISSIONAL } from "@/lib/legalizacaoMatriz";
import { cn } from "@/lib/utils";
import type {
  DocumentoUnidade,
  MovimentacaoProfissionalPayload,
  TipoMovimentacaoProfissional,
} from "@/types/legalizacao";

const CODIGO_CNES = "cnes";
const CODIGO_DOSIMETRIA = "dosimetria";
// Espelha ANTECEDENCIA_MINIMA_DOSIMETRO_DIAS (backend, legalizacao/views.py,
// RN12) -- validação client-side é só UX antecipada, o backend rejeita de
// qualquer jeito se este número divergir do real.
const ANTECEDENCIA_MINIMA_DOSIMETRO_DIAS = 30;

type FuncaoMovimentacao =
  | "rt_medico"
  | "rt_enfermagem"
  | "tecnico_radiologia"
  | "responsavel_posto_coleta";

const LABEL_FUNCAO: Record<FuncaoMovimentacao, string> = {
  rt_medico: "Responsável Técnico (Médico)",
  rt_enfermagem: "Responsável Técnico (Enfermagem)",
  tecnico_radiologia: "Técnico de Radiologia",
  responsavel_posto_coleta: "Responsável, Posto de Coleta",
};

// Provisório -- decide só a PRÉ-marcação inicial do checklist ao abrir o
// modal ou trocar de Função, nunca bloqueia nem desmarca escolha manual
// depois disso (issue STC-382: "mapeamento de UX ainda não validado com o
// negócio"). "Posto de Coleta" não tem código próprio no catálogo hoje (só
// cnes/dosimetria/registro-cremerj/registro-coren) -- fica só com CNES
// pré-marcado até um tipo dedicado existir.
const CODIGOS_POR_FUNCAO: Record<FuncaoMovimentacao, string[]> = {
  rt_medico: [CODIGO_CNES, "registro-cremerj"],
  rt_enfermagem: [CODIGO_CNES, "registro-coren"],
  tecnico_radiologia: [CODIGO_CNES, CODIGO_DOSIMETRIA],
  responsavel_posto_coleta: [CODIGO_CNES],
};

function hojeLocal(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// "YYYY-MM-DD" como componentes locais, não Date.parse (que trata a string
// como UTC meia-noite e pode voltar um dia em fusos atrás de UTC) -- mesmo
// cuidado já registrado em ProcessoRenovacaoModal.tsx pra datetime, aqui
// aplicado a um campo só de data.
function paraDataLocal(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function dataMinimaDosimetro(): Date {
  const minima = paraDataLocal(hojeLocal());
  minima.setDate(minima.getDate() + ANTECEDENCIA_MINIMA_DOSIMETRO_DIAS);
  return minima;
}

function TextoCallout({ tipo }: { tipo: TipoMovimentacaoProfissional }) {
  if (tipo === "saida") {
    return (
      <>
        Ao confirmar, os documentos marcados mudam para <strong>Vencido</strong>{" "}
        imediatamente, sem esperar a varredura diária, e a Legalização recebe um
        alerta agora.
      </>
    );
  }
  return (
    <>
      Ao confirmar, os documentos marcados entram em atualização (status{" "}
      <strong>Em andamento</strong>) e a Legalização é avisada pra iniciar a
      indicação do novo profissional. Se envolver técnico de radiologia, o
      dosímetro precisa ser solicitado com pelo menos{" "}
      {ANTECEDENCIA_MINIMA_DOSIMETRO_DIAS} dias de antecedência.
    </>
  );
}

export function MovimentacaoProfissionalModal({
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
  const [tipo, setTipo] = useState<TipoMovimentacaoProfissional>("saida");
  const [profissional, setProfissional] = useState("");
  const [data, setData] = useState(hojeLocal());
  const [funcao, setFuncao] = useState<FuncaoMovimentacao>("rt_medico");
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [confirmados, setConfirmados] = useState<Set<number>>(new Set());
  const [errosPorDocumento, setErrosPorDocumento] = useState<
    Record<number, string>
  >({});
  const [enviando, setEnviando] = useState(false);
  // Guarda contra a pré-marcação rodar de novo a cada revalidação em
  // background dos documentos afetados (poll de 60s do useDocumentosLegalizacao
  // enquanto o modal está aberto) -- sem isto, o checklist voltaria a
  // "sugestão da Função" no meio de uma edição manual do usuário. Resetado
  // em fechar(), então uma reabertura pra outro documento reinicializa certo.
  const jaInicializouRef = useRef(false);

  const { documentos: documentosDaUnidade, isLoading: carregandoAfetados } =
    useDocumentosLegalizacao(
      documento ? { unidade: documento.unidade.id } : undefined,
      { desabilitado: !aberto || !documento },
    );
  const documentosAfetados = documentosDaUnidade.filter(
    (doc) =>
      doc.status !== "nao_aplicavel" &&
      doc.status !== "unidade_encerramento" &&
      CODIGOS_MOVIMENTACAO_PROFISSIONAL.has(doc.tipo_documento.codigo),
  );

  if (!jaInicializouRef.current && documentosAfetados.length > 0) {
    jaInicializouRef.current = true;
    const codigosFuncao = CODIGOS_POR_FUNCAO[funcao];
    const sugeridos = documentosAfetados
      .filter((doc) => codigosFuncao.includes(doc.tipo_documento.codigo))
      .map((doc) => doc.id);
    setMarcados(new Set(sugeridos));
  }

  const { reportar } = useReportarMovimentacaoProfissional();

  function fechar() {
    setTipo("saida");
    setProfissional("");
    setData(hojeLocal());
    setFuncao("rt_medico");
    setMarcados(new Set());
    setConfirmados(new Set());
    setErrosPorDocumento({});
    setEnviando(false);
    jaInicializouRef.current = false;
    onOpenChange(false);
  }

  function alternarMarcado(id: number) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function trocarFuncao(novaFuncao: FuncaoMovimentacao) {
    setFuncao(novaFuncao);
    const codigosFuncao = CODIGOS_POR_FUNCAO[novaFuncao];
    const sugeridos = documentosAfetados
      .filter((doc) => codigosFuncao.includes(doc.tipo_documento.codigo))
      .map((doc) => doc.id);
    setMarcados(new Set(sugeridos));
  }

  const documentoDosimetriaMarcado = documentosAfetados.find(
    (doc) =>
      marcados.has(doc.id) && doc.tipo_documento.codigo === CODIGO_DOSIMETRIA,
  );
  const antecedenciaDosimetroInsuficiente =
    tipo === "entrada" &&
    !!documentoDosimetriaMarcado &&
    !!data &&
    paraDataLocal(data) < dataMinimaDosimetro();

  const documentoCnesMarcado = documentosAfetados.find(
    (doc) => marcados.has(doc.id) && doc.tipo_documento.codigo === CODIGO_CNES,
  );
  const janelaCnes = documentoCnesMarcado?.regra_aplicada;

  const haErroPendente = Object.keys(errosPorDocumento).length > 0;
  const podeConfirmar =
    !!profissional.trim() &&
    !!data &&
    marcados.size > 0 &&
    !antecedenciaDosimetroInsuficiente &&
    !enviando;

  async function confirmar() {
    if (!podeConfirmar) return;
    const idsParaEnviar = Array.from(marcados).filter(
      (id) => !confirmados.has(id),
    );
    if (idsParaEnviar.length === 0) return;

    setEnviando(true);
    const payload: MovimentacaoProfissionalPayload = {
      tipo,
      profissional: profissional.trim(),
      data,
    };
    // Não existe endpoint em lote no backend -- uma chamada por documento
    // marcado, concorrentes, cada uma com resultado tratado
    // independentemente (critério de aceite da issue: uma falha não desfaz
    // as que já confirmaram).
    const resultados = await Promise.allSettled(
      idsParaEnviar.map((id) => reportar(id, payload).then(() => id)),
    );
    setEnviando(false);

    const novosConfirmados = new Set(confirmados);
    const novosErros = { ...errosPorDocumento };
    resultados.forEach((resultado, indice) => {
      const id = idsParaEnviar[indice];
      if (resultado.status === "fulfilled") {
        novosConfirmados.add(id);
        delete novosErros[id];
      } else {
        novosErros[id] = extrairMensagemErro(resultado.reason);
      }
    });
    setConfirmados(novosConfirmados);
    setErrosPorDocumento(novosErros);

    const houveSucesso = resultados.some((r) => r.status === "fulfilled");
    const houveFalha = resultados.some((r) => r.status === "rejected");
    if (houveSucesso) onAtualizado();

    if (!houveFalha) {
      toast.success(
        tipo === "saida" ? "Saída reportada." : "Entrada reportada.",
      );
      fechar();
    } else if (houveSucesso) {
      toast.error(
        "Alguns documentos não puderam ser atualizados -- veja os detalhes abaixo.",
      );
    } else {
      toast.error("Não foi possível reportar a movimentação.");
    }
  }

  const IconeModo = tipo === "saida" ? UserX : UserPlus;
  const corModo = tipo === "saida" ? "text-red-600" : "text-cyan-700";

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[480px]">
        {documento && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconeModo className={cn("size-4", corModo)} />
                Reportar movimentação profissional
              </DialogTitle>
              <p className="text-[12.5px] text-muted-foreground">
                {documento.unidade.nome} · impacta RT, CNES ou dosimetria
              </p>
            </DialogHeader>

            <div className="scrollbar-discreta flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Tipo de movimentação</Label>
                <div className="flex rounded-md bg-muted p-0.5">
                  {(["saida", "entrada"] as const).map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={tipo === valor}
                      onClick={() => setTipo(valor)}
                      className={cn(
                        "flex-1 rounded-[5px] px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors",
                        tipo === valor &&
                          "bg-card shadow-xs " +
                            (valor === "saida"
                              ? "text-red-600"
                              : "text-cyan-700"),
                      )}
                    >
                      {valor === "saida" ? "Saída" : "Entrada"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mp-profissional" className="text-xs">
                  Profissional
                </Label>
                <Input
                  id="mp-profissional"
                  value={profissional}
                  onChange={(evento) => setProfissional(evento.target.value)}
                  placeholder="Nome do profissional"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mp-funcao" className="text-xs">
                  Função
                </Label>
                <Select
                  value={funcao}
                  onValueChange={(valor) =>
                    trocarFuncao(valor as FuncaoMovimentacao)
                  }
                >
                  <SelectTrigger id="mp-funcao" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LABEL_FUNCAO) as FuncaoMovimentacao[]).map(
                      (valor) => (
                        <SelectItem key={valor} value={valor}>
                          {LABEL_FUNCAO[valor]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mp-data" className="text-xs">
                  Data da movimentação
                </Label>
                <Input
                  id="mp-data"
                  type="date"
                  value={data}
                  onChange={(evento) => setData(evento.target.value)}
                  className="max-w-[200px]"
                />
                {antecedenciaDosimetroInsuficiente && (
                  <p className="text-[11.5px] text-destructive">
                    Entrada em documento de Dosimetria exige data com pelo menos{" "}
                    {ANTECEDENCIA_MINIMA_DOSIMETRO_DIAS} dias de antecedência
                    (RN12).
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  Documentos afetados nesta unidade
                </Label>
                {carregandoAfetados ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : documentosAfetados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum documento regulado por movimentação de profissional
                    está cadastrado nesta unidade.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {documentosAfetados.map((doc) => {
                      const confirmado = confirmados.has(doc.id);
                      const erro = errosPorDocumento[doc.id];
                      return (
                        <div key={doc.id} className="flex flex-col gap-1">
                          <label
                            className={cn(
                              "flex items-center gap-2 rounded-md bg-muted px-2.5 py-2 text-[12.5px]",
                              confirmado && "opacity-60",
                            )}
                          >
                            <Checkbox
                              checked={marcados.has(doc.id)}
                              disabled={confirmado || enviando}
                              onCheckedChange={() => alternarMarcado(doc.id)}
                            />
                            {doc.tipo_documento.nome}
                            {confirmado && (
                              <span className="ml-auto text-[11px] font-semibold text-green-700">
                                Confirmado
                              </span>
                            )}
                          </label>
                          {erro && (
                            <p className="pl-2 text-[11.5px] text-destructive">
                              {erro}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {documentoCnesMarcado && (
                <div className="flex items-start gap-2 rounded-md border border-amber-600/25 bg-amber-600/5 p-2.5 text-[12px] text-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
                  <span>
                    {janelaCnes?.janela_dia_inicio != null &&
                    janelaCnes?.janela_dia_fim != null ? (
                      <>
                        O CNES só aceita essa atualização entre os dias{" "}
                        <strong>
                          {janelaCnes.janela_dia_inicio} e{" "}
                          {janelaCnes.janela_dia_fim}
                        </strong>{" "}
                        do mês (RN13). Fora dessa janela, o registro fica pronto
                        aqui, mas a Legalização só consegue executar no CNES
                        quando ela abrir de novo.
                      </>
                    ) : (
                      "O CNES tem uma janela operacional restrita pra aceitar essa atualização (RN13). Confirme o período em vigor com a Legalização antes de considerar isso concluído lá."
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-2.5 text-[12px] text-foreground">
                <AlertTriangle
                  className={cn("mt-0.5 size-3.5 shrink-0", corModo)}
                />
                <span>
                  <TextoCallout tipo={tipo} />
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={fechar} disabled={enviando}>
                Cancelar
              </Button>
              <Button
                disabled={!podeConfirmar}
                onClick={() => void confirmar()}
                className={cn(
                  tipo === "saida"
                    ? "bg-red-600 hover:bg-red-600/90"
                    : "bg-cyan-700 hover:bg-cyan-700/90",
                )}
              >
                {enviando
                  ? "Enviando..."
                  : haErroPendente
                    ? "Tentar novamente"
                    : tipo === "saida"
                      ? "Confirmar saída"
                      : "Confirmar entrada"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
