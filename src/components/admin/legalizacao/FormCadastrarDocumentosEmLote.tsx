"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCriarDocumentosLegalizacaoEmLote,
  useDocumentosLegalizacao,
} from "@/hooks/useDocumentosLegalizacao";
import { useTiposDocumento } from "@/hooks/useTiposDocumento";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import { atualizarDocumentoLegalizacao, enviarEvidenciaLegalizacao } from "@/lib/legalizacao";
import { LABEL_STATUS } from "@/lib/legalizacaoMatriz";
import type { DocumentoUnidade, StatusDocumento } from "@/types/legalizacao";

type StatusEnvio = "enviando" | "enviado" | "erro";
type StatusSalvamento = "salvando" | "salvo" | "erro";

// Mesma lista de FormCadastrarDocumento.tsx (sem Não aplicável/Unidade em
// encerramento, que não fazem sentido pra um cadastro em lote de
// equipamento) -- duplicada em vez de exportada de lá, mesmo espírito de
// numeroDiaOpcional abaixo: as duas telas evoluem separado.
const STATUS_INICIAIS: StatusDocumento[] = [
  "nao_iniciado",
  "em_andamento",
  "protocolado",
  "regular",
  "vencido",
];

// z.coerce.number() sozinho transforma "" (campo em branco) em 0, não
// undefined -- mesmo achado já registrado em FormCadastrarDocumento.tsx.
const numeroDiaOpcional = z.preprocess(
  (valor) => (valor === "" ? undefined : valor),
  z.coerce.number().int().min(1).max(31).optional(),
);

// Um identificador por linha (colar de uma planilha é o caso comum -- 20
// balanças de uma vez) -- mais simples e mais rápido de preencher que um
// componente de lista com botão de adicionar/remover por linha.
function parseIdentificadores(texto: string): string[] {
  return texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha !== "");
}

const schema = z
  .object({
    unidade: z.coerce.number({ error: "Selecione a unidade." }).int().positive(),
    tipo_documento: z.coerce
      .number({ error: "Selecione o tipo de documento." })
      .int()
      .positive(),
    vigente_a_partir: z.string().min(1, "Obrigatório."),
    antecedencia_dias: z.coerce.number().int().min(0),
    janela_dia_inicio: numeroDiaOpcional,
    janela_dia_fim: numeroDiaOpcional,
    identificadores_texto: z.string(),
    gera_card_demanda: z.boolean(),
  })
  .refine((v) => parseIdentificadores(v.identificadores_texto).length > 0, {
    message: "Informe ao menos um identificador (um por linha).",
    path: ["identificadores_texto"],
  })
  .refine(
    (v) => {
      const identificadores = parseIdentificadores(v.identificadores_texto);
      return new Set(identificadores).size === identificadores.length;
    },
    {
      message: "Identificadores duplicados -- cada linha precisa ser única.",
      path: ["identificadores_texto"],
    },
  );

type FormValuesEntrada = z.input<typeof schema>;
type FormValuesSaida = z.output<typeof schema>;

const valoresPadrao: Partial<FormValuesEntrada> = {
  identificadores_texto: "",
  gera_card_demanda: true,
};

export function FormCadastrarDocumentosEmLote({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { unidades } = useUnidades();
  const { tiposDocumento } = useTiposDocumento();
  const { criar: criarLote, isLoading: salvando } = useCriarDocumentosLegalizacaoEmLote();

  // Não-nulo == passo 2 (anexar evidências) -- documentos já criados de
  // verdade nesse ponto, este estado só controla qual etapa do MESMO
  // diálogo é exibida, não é um campo do formulário react-hook-form.
  const [documentosCriados, setDocumentosCriados] = useState<
    DocumentoUnidade[] | null
  >(null);
  const [statusEnvio, setStatusEnvio] = useState<Record<number, StatusEnvio>>(
    {},
  );
  // Achado no dogfooding: faltava jeito de dizer o status/validade real de
  // cada item -- "Vigente a partir" acima é da REGRA (prazo/antecedência,
  // compartilhado), não da validade de cada documento (por instância,
  // pode ser uma data diferente por equipamento mesmo cadastrando junto).
  const [statusPorItem, setStatusPorItem] = useState<
    Record<number, StatusDocumento | "">
  >({});
  const [validadePorItem, setValidadePorItem] = useState<Record<number, string>>(
    {},
  );
  const [statusSalvamento, setStatusSalvamento] = useState<
    Record<number, StatusSalvamento>
  >({});
  const [erroSalvamento, setErroSalvamento] = useState<Record<number, string>>(
    {},
  );

  // Sempre disponíveis, mesmo já tendo instâncias cadastradas antes -- é
  // exatamente o ponto deste formulário (mesmo raciocínio já usado pra
  // controlado_por_profissional em FormCadastrarDocumento.tsx, mas sem a
  // exigência de "ainda não cadastrado" fazer sentido aqui: você volta
  // aqui de novo pra cadastrar mais instâncias no futuro).
  const tiposDisponiveis = useMemo(
    () => tiposDocumento.filter((tipo) => tipo.ativo && tipo.permite_multiplas_instancias),
    [tiposDocumento],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValuesEntrada, unknown, FormValuesSaida>({
    resolver: zodResolver(schema),
    defaultValues: valoresPadrao,
  });

  const unidadeSelecionada = watch("unidade") as number | undefined;
  const tipoDocumentoSelecionado = watch("tipo_documento") as number | undefined;

  // Achado no dogfooding: sem isto, um 2º lote pro mesmo tipo+unidade
  // (ex.: "esqueceram uma balança") deixava os campos de regra editáveis
  // de novo, o usuário digitava valores novos, e o backend descartava
  // tudo silenciosamente pra reaproveitar a regra já existente -- dava a
  // falsa impressão de que os valores digitados tinham sido usados. Mesmo
  // padrão de FormCadastrarDocumento.tsx: detecta, pré-preenche e trava.
  const {
    documentos: documentosDaUnidade,
    isFilterChangeValidating: verificandoRegraExistente,
  } = useDocumentosLegalizacao(
    { unidade: unidadeSelecionada },
    { desabilitado: !unidadeSelecionada },
  );
  const regraExistente = tipoDocumentoSelecionado
    ? (documentosDaUnidade.find(
        (doc) => doc.tipo_documento.id === tipoDocumentoSelecionado && doc.regra_aplicada,
      )?.regra_aplicada ?? null)
    : null;

  useEffect(() => {
    if (!regraExistente) return;
    setValue("vigente_a_partir", regraExistente.vigente_a_partir);
    setValue("antecedencia_dias", regraExistente.antecedencia_dias);
    setValue("janela_dia_inicio", regraExistente.janela_dia_inicio ?? undefined);
    setValue("janela_dia_fim", regraExistente.janela_dia_fim ?? undefined);
    setValue("gera_card_demanda", regraExistente.gera_card_demanda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regraExistente?.id, setValue]);

  // Achado em análise própria de falhas críticas: o efeito acima só
  // preenche os campos quando regraExistente existe -- nunca os limpa
  // quando deixa de existir (troca de tipo/unidade saindo de uma
  // combinação com regra já cadastrada pra outra sem regra). Sem isto, os
  // valores da regra anterior ficavam visíveis e editáveis, prontos pra ir
  // no submit como se fossem da regra nova. Mesmo padrão de
  // FormCadastrarDocumento.tsx (limparCamposDeRegra).
  function limparCamposDeRegra() {
    setValue("vigente_a_partir", "");
    setValue("antecedencia_dias", "");
    setValue("janela_dia_inicio", undefined);
    setValue("janela_dia_fim", undefined);
    setValue("gera_card_demanda", valoresPadrao.gera_card_demanda ?? true);
  }

  function fechar() {
    reset(valoresPadrao);
    setDocumentosCriados(null);
    setStatusEnvio({});
    setStatusPorItem({});
    setValidadePorItem({});
    setStatusSalvamento({});
    setErroSalvamento({});
    onOpenChange(false);
  }

  async function aoSubmeter(valores: FormValuesSaida) {
    const identificadores = parseIdentificadores(valores.identificadores_texto);
    try {
      const documentos = await criarLote({
        tipo_documento: valores.tipo_documento,
        unidade: valores.unidade,
        vigente_a_partir: valores.vigente_a_partir,
        antecedencia_dias: valores.antecedencia_dias,
        janela_dia_inicio: valores.janela_dia_inicio ?? null,
        janela_dia_fim: valores.janela_dia_fim ?? null,
        // STC-486: nunca escolhida pelo usuário, sempre fixa.
        criticidade: "alta",
        gera_card_demanda: valores.gera_card_demanda,
        identificadores,
      });
      toast.success(`${documentos.length} documento(s) cadastrado(s).`);
      // Passo 2 -- evidência é por instância (cada balança tem seu próprio
      // certificado), diferente da regra (compartilhada por todos aqui em
      // cima). Documentos já existem de verdade nesse ponto; fechar sem
      // anexar nada não perde nada, só adia (dá pra anexar depois na
      // Matriz de Conformidade, um por um).
      setDocumentosCriados(documentos);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function salvarStatusEValidade(documentoId: number) {
    const status = statusPorItem[documentoId];
    const validade = validadePorItem[documentoId] ?? "";
    if (!status) {
      setErroSalvamento((e) => ({ ...e, [documentoId]: "Selecione o status." }));
      return;
    }
    // Mesma regra de FormCadastrarDocumento.tsx/DocumentoUnidadeWriteSerializer
    // (backend): "Vencido" sempre exige validade.
    if (status === "vencido" && !validade) {
      setErroSalvamento((e) => ({
        ...e,
        [documentoId]: "Validade obrigatória para status 'Vencido'.",
      }));
      return;
    }
    setErroSalvamento((e) => ({ ...e, [documentoId]: "" }));
    setStatusSalvamento((s) => ({ ...s, [documentoId]: "salvando" }));
    try {
      await atualizarDocumentoLegalizacao(documentoId, {
        status,
        validade: validade || null,
      });
      setStatusSalvamento((s) => ({ ...s, [documentoId]: "salvo" }));
    } catch (erro) {
      setStatusSalvamento((s) => ({ ...s, [documentoId]: "erro" }));
      toast.error(extrairMensagemErro(erro));
    }
  }

  async function enviarEvidenciaDoItem(documentoId: number, arquivo: File) {
    setStatusEnvio((s) => ({ ...s, [documentoId]: "enviando" }));
    try {
      await enviarEvidenciaLegalizacao(documentoId, arquivo);
      setStatusEnvio((s) => ({ ...s, [documentoId]: "enviado" }));
    } catch (erro) {
      setStatusEnvio((s) => ({ ...s, [documentoId]: "erro" }));
      toast.error(extrairMensagemErro(erro));
    }
  }

  if (documentosCriados) {
    return (
      <Dialog open={open} onOpenChange={(valor) => !valor && fechar()}>
        <DialogContent
          className="flex max-h-[85vh] max-w-[min(30rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0"
          // Achado no dogfooding: clicar fora/Esc aqui não "cancela" nada --
          // os documentos já foram criados de verdade no passo 1. Deixar
          // fechar sem querer nesse passo passaria a falsa impressão de
          // que a criação também foi desfeita, igual clicar fora no passo
          // 1 (esse sim cancela de verdade, antes de qualquer chamada à
          // API). Só fecha por ação explícita (X ou "Concluir").
          onInteractOutside={(evento) => evento.preventDefault()}
          onEscapeKeyDown={(evento) => evento.preventDefault()}
        >
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>Anexar evidências (opcional)</DialogTitle>
          </DialogHeader>

          <div className="scrollbar-discreta flex-1 space-y-3 overflow-y-auto px-6 py-5">
            <p className="text-sm text-muted-foreground">
              Status, validade e evidência são por item -- cada equipamento
              pode ter sua própria data de calibração e certificado. Tudo
              opcional aqui: dá pra completar depois, um por um, na Matriz de
              Conformidade.
            </p>
            {documentosCriados.map((documento) => (
              <div
                key={documento.id}
                className="space-y-2 rounded-lg border border-border px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {documento.profissional}
                  </span>
                  <LinhaEvidencia
                    identificador={documento.profissional}
                    status={statusEnvio[documento.id]}
                    onSelecionar={(arquivo) =>
                      void enviarEvidenciaDoItem(documento.id, arquivo)
                    }
                  />
                </div>
                <LinhaStatusValidade
                  documentoId={documento.id}
                  identificador={documento.profissional}
                  status={statusPorItem[documento.id] ?? ""}
                  validade={validadePorItem[documento.id] ?? ""}
                  statusSalvamento={statusSalvamento[documento.id]}
                  erro={erroSalvamento[documento.id]}
                  onStatusChange={(valor) =>
                    setStatusPorItem((s) => ({ ...s, [documento.id]: valor }))
                  }
                  onValidadeChange={(valor) =>
                    setValidadePorItem((v) => ({ ...v, [documento.id]: valor }))
                  }
                  onSalvar={() => void salvarStatusEValidade(documento.id)}
                />
              </div>
            ))}
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button onClick={fechar}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(valor) => !valor && fechar()}>
      <DialogContent className="flex max-h-[85vh] max-w-[min(30rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Cadastrar documentos em lote</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="scrollbar-discreta flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <p className="text-sm text-muted-foreground">
              Pra tipos de documento com múltiplas instâncias por unidade
              (ex.: um documento de calibração por equipamento). A mesma
              regra de prazo vale pra todos os itens cadastrados aqui.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="cel-unidade">
                Unidade <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="unidade"
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(valor) => {
                      field.onChange(Number(valor));
                      limparCamposDeRegra();
                    }}
                  >
                    <SelectTrigger id="cel-unidade" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.map((unidade) => (
                        <SelectItem key={unidade.id} value={String(unidade.id)}>
                          {unidade.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.unidade && (
                <p className="text-xs text-destructive">{errors.unidade.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cel-tipo">
                Tipo de documento <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="tipo_documento"
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(valor) => {
                      field.onChange(Number(valor));
                      limparCamposDeRegra();
                    }}
                  >
                    <SelectTrigger id="cel-tipo" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposDisponiveis.map((tipo) => (
                        <SelectItem key={tipo.id} value={String(tipo.id)}>
                          {tipo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tipo_documento && (
                <p className="text-xs text-destructive">
                  {errors.tipo_documento.message}
                </p>
              )}
              {tiposDisponiveis.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum tipo de documento está marcado para múltiplas
                  instâncias ainda -- configure isso no cadastro do tipo de
                  documento acima.
                </p>
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              <h3 className="text-sm font-semibold text-foreground">
                Regra desta unidade
              </h3>
              <p className="text-xs text-muted-foreground">
                {regraExistente
                  ? "Este tipo já tem uma regra cadastrada nesta unidade (reaproveitada do lote anterior) -- os campos abaixo só mostram os valores já em vigor, não editáveis aqui."
                  : "Os valores abaixo valem só para esta unidade e este tipo de documento. Cada unidade tem seu próprio prazo, mesmo sendo o mesmo tipo de documento."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cel-vigente">
                  Vigente a partir <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cel-vigente"
                  type="date"
                  disabled={!!regraExistente}
                  {...register("vigente_a_partir")}
                />
                {errors.vigente_a_partir && (
                  <p className="text-xs text-destructive">
                    {errors.vigente_a_partir.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cel-antecedencia">
                  Antecedência (dias) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cel-antecedencia"
                  type="number"
                  min={0}
                  disabled={!!regraExistente}
                  {...register("antecedencia_dias")}
                />
                {errors.antecedencia_dias && (
                  <p className="text-xs text-destructive">
                    {errors.antecedencia_dias.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cel-janela-inicio">Início da janela (dia)</Label>
                <Input
                  id="cel-janela-inicio"
                  type="number"
                  min={1}
                  max={31}
                  disabled={!!regraExistente}
                  {...register("janela_dia_inicio")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cel-janela-fim">Fim da janela (dia)</Label>
                <Input
                  id="cel-janela-fim"
                  type="number"
                  min={1}
                  max={31}
                  disabled={!!regraExistente}
                  {...register("janela_dia_fim")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cel-identificadores">
                Identificadores <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cel-identificadores"
                rows={6}
                placeholder={"Balança 01\nBalança 02\nBalança 03"}
                {...register("identificadores_texto")}
              />
              <p className="text-xs text-muted-foreground">
                Um por linha -- um documento é criado pra cada linha.
              </p>
              {errors.identificadores_texto && (
                <p className="text-xs text-destructive">
                  {errors.identificadores_texto.message}
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Controller
                control={control}
                name="gera_card_demanda"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    disabled={!!regraExistente}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              Gerar card em Gestão de Demandas quando o processo de
              renovação começar (vale pra todos os itens)
            </label>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || verificandoRegraExistente}>
              {salvando
                ? "Cadastrando..."
                : verificandoRegraExistente
                  ? "Verificando regra..."
                  : "Cadastrar documentos"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Envio dispara direto na seleção do arquivo (sem botão "enviar" separado)
// -- cada linha é independente, uma falha não afeta as outras (mesmo
// espírito "best effort" já usado em outras integrações do projeto).
function LinhaEvidencia({
  identificador,
  status,
  onSelecionar,
}: {
  identificador: string;
  status: StatusEnvio | undefined;
  onSelecionar: (arquivo: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (status === "enviando") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Enviando...
      </span>
    );
  }

  if (status === "enviado") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-emerald-600">
        <Check className="size-3.5" />
        Enviado
      </span>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {status === "erro" && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <X className="size-3.5" />
          Falhou
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          if (arquivo) onSelecionar(arquivo);
          evento.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={
          status === "erro"
            ? `Tentar anexar evidência de novo para ${identificador}`
            : `Anexar evidência para ${identificador}`
        }
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Paperclip className="size-3.5" />
        {status === "erro" ? "Tentar de novo" : "Anexar"}
      </button>
    </div>
  );
}

// Status/validade não usam react-hook-form (estado local simples, uma
// linha independente da outra) -- "Salvar" é explícito (diferente da
// evidência, que envia na hora) porque os dois campos precisam fazer
// sentido juntos antes de ir pro PATCH (Vencido exige validade).
function LinhaStatusValidade({
  documentoId,
  identificador,
  status,
  validade,
  statusSalvamento,
  erro,
  onStatusChange,
  onValidadeChange,
  onSalvar,
}: {
  documentoId: number;
  identificador: string;
  status: StatusDocumento | "";
  validade: string;
  statusSalvamento: StatusSalvamento | undefined;
  erro: string | undefined;
  onStatusChange: (valor: StatusDocumento) => void;
  onValidadeChange: (valor: string) => void;
  onSalvar: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[8rem] flex-1 space-y-1">
          <Label htmlFor={`lel-status-${documentoId}`} className="text-xs">
            Status inicial
          </Label>
          <Select
            value={status}
            onValueChange={(valor) => onStatusChange(valor as StatusDocumento)}
          >
            <SelectTrigger id={`lel-status-${documentoId}`} className="h-8 text-xs">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {STATUS_INICIAIS.map((valor) => (
                <SelectItem key={valor} value={valor}>
                  {LABEL_STATUS[valor]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[8rem] flex-1 space-y-1">
          <Label htmlFor={`lel-validade-${documentoId}`} className="text-xs">
            Validade
          </Label>
          <Input
            id={`lel-validade-${documentoId}`}
            type="date"
            className="h-8 text-xs"
            value={validade}
            onChange={(evento) => onValidadeChange(evento.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={statusSalvamento === "salvando"}
          aria-label={`Salvar status e validade de ${identificador}`}
          onClick={onSalvar}
        >
          {statusSalvamento === "salvando"
            ? "Salvando..."
            : statusSalvamento === "salvo"
              ? "Salvo"
              : "Salvar"}
        </Button>
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
