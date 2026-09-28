"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SeletorResponsaveis } from "@/components/admin/legalizacao/SeletorResponsaveis";
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
import { useAuth } from "@/hooks/useAuth";
import {
  useCriarDocumentosLegalizacaoEmLote,
  useDocumentosLegalizacao,
} from "@/hooks/useDocumentosLegalizacao";
import { useTiposDocumento } from "@/hooks/useTiposDocumento";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import { atualizarDocumentoLegalizacao, enviarEvidenciaLegalizacao } from "@/lib/legalizacao";
import { LABEL_STATUS } from "@/lib/legalizacaoMatriz";
import { hojeISO } from "@/lib/utils";
import type { DocumentoUnidade, StatusDocumento } from "@/types/legalizacao";

// STC-524: status que pressupõem documento em mãos -- exigem evidência
// anexada no passo 2 antes de "Concluir" liberar. Os demais (não iniciado,
// em andamento, vencido) continuam sem exigir nada, comportamento já
// existente.
const STATUS_EXIGE_EVIDENCIA = new Set<StatusDocumento>(["regular", "protocolado"]);

type StatusEnvio = "enviando" | "enviado" | "erro";

// STC-523: antecedência de alerta padronizada em 60 dias pra toda a rede
// (decisão de negócio, reunião 23/09/2026) -- campo trava nesta constante em
// vez de input editável; exceção só via Django Admin, direto no banco.
const ANTECEDENCIA_PADRAO_DIAS = 60;

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
    // STC-516/STC-517: 1 seleção só, vale pra todos os documentos do lote.
    responsaveis: z
      .array(z.number())
      .min(1, "Selecione pelo menos 1 responsável."),
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

// Função, não objeto estático (STC-523): "vigente_a_partir" precisa
// refletir o dia em que o formulário É ABERTO, não o dia em que o módulo
// carregou no navegador -- mesmo raciocínio de FormCadastrarDocumento.tsx.
function criarValoresPadrao(): Partial<FormValuesEntrada> {
  return {
    identificadores_texto: "",
    gera_card_demanda: true,
    responsaveis: [],
    vigente_a_partir: hojeISO(),
    antecedencia_dias: ANTECEDENCIA_PADRAO_DIAS,
  };
}

export function FormCadastrarDocumentosEmLote({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, isCoordenacaoUnidade } = useAuth();
  const { unidades: todasAsUnidades } = useUnidades("padrao");
  // STC-514: mesmo critério de FormCadastrarDocumento.tsx -- Coordenador só
  // pode cadastrar em lote na própria unidade.
  const unidades = isCoordenacaoUnidade
    ? todasAsUnidades.filter((unidade) => unidade.id === user?.unidade_id)
    : todasAsUnidades;
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
  const [erroSalvamento, setErroSalvamento] = useState<Record<number, string>>(
    {},
  );
  const [concluindo, setConcluindo] = useState(false);

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
    defaultValues: criarValoresPadrao(),
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
    // STC-523: volta pros mesmos defaults do formulário recém-aberto (hoje e
    // 60), não mais vazio -- os dois campos são fixos/pré-preenchidos por
    // padrão, deixar de reaproveitar uma regra existente não deveria
    // esvaziá-los.
    setValue("vigente_a_partir", hojeISO());
    setValue("antecedencia_dias", ANTECEDENCIA_PADRAO_DIAS);
    setValue("janela_dia_inicio", undefined);
    setValue("janela_dia_fim", undefined);
    setValue("gera_card_demanda", true);
    // STC-517: candidatos a responsável dependem de unidade+tipo -- mesmo
    // motivo de FormCadastrarDocumento.tsx.
    setValue("responsaveis", []);
  }

  // STC-523 (achado em code review): reseta ao ABRIR também, não só ao
  // fechar (fechar() já fazia isso) -- este formulário nunca desmonta
  // (`CatalogoLegalizacaoAdmin.tsx` fica `hidden` entre trocas de aba, não
  // desmonta), então sem isso `criarValoresPadrao()` só recalculava "hoje"
  // na montagem inicial da página e no fechamento anterior. Uma aba deixada
  // aberta de um dia pro outro, sem nunca ter aberto/fechado este diálogo
  // antes, mostraria "Data de início dos alertas" pré-preenchida com o dia
  // de ontem na primeira abertura.
  //
  // Efeito DECLARADO ANTES do de baixo (STC-514) de propósito: os dois
  // rodam no mesmo commit quando `open` vira true, na ordem em que aparecem
  // no componente -- reset() aqui limpa `unidade` (não faz parte de
  // criarValoresPadrao()) antes do efeito de baixo preenchê-la pro
  // Coordenador; na ordem inversa, este reset() apagaria o valor que o
  // outro acabou de definir.
  useEffect(() => {
    if (open) reset(criarValoresPadrao());
  }, [open, reset]);

  // STC-514: seletor de unidade travado na do Coordenador -- sem opção de
  // escolher outra (senão 403 no submit, o backend só permite escrever na
  // própria). Depende de `open` pra reaplicar toda vez que o form reabre
  // (fechar() reseta `unidade` pra undefined via reset(criarValoresPadrao())).
  useEffect(() => {
    if (!open || !isCoordenacaoUnidade || !user?.unidade_id) return;
    setValue("unidade", user.unidade_id);
  }, [open, isCoordenacaoUnidade, user?.unidade_id, setValue]);

  function fechar() {
    reset(criarValoresPadrao());
    setDocumentosCriados(null);
    setStatusEnvio({});
    setStatusPorItem({});
    setValidadePorItem({});
    setErroSalvamento({});
    setConcluindo(false);
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
        responsaveis: valores.responsaveis,
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

  // STC-531 (achado do usuário): retorna sucesso/falha -- reaproveitada por
  // concluir() pra salvar todo item de uma vez, não só por um clique
  // individual (que não existe mais nesta tela).
  async function salvarStatusEValidade(documentoId: number): Promise<boolean> {
    const status = statusPorItem[documentoId];
    const validade = validadePorItem[documentoId] ?? "";
    if (!status) {
      setErroSalvamento((e) => ({ ...e, [documentoId]: "Selecione o status." }));
      return false;
    }
    // Mesma regra de FormCadastrarDocumento.tsx/DocumentoUnidadeWriteSerializer
    // (backend): "Vencido" sempre exige validade.
    if (status === "vencido" && !validade) {
      setErroSalvamento((e) => ({
        ...e,
        [documentoId]: "Validade obrigatória para status 'Vencido'.",
      }));
      return false;
    }
    // STC-524: "Regular"/"Protocolado" pressupõem documento em mãos -- só
    // esses dois exigem evidência antes de persistir o status.
    if (
      STATUS_EXIGE_EVIDENCIA.has(status) &&
      statusEnvio[documentoId] !== "enviado"
    ) {
      setErroSalvamento((e) => ({
        ...e,
        [documentoId]: `Anexe a evidência antes de salvar como "${LABEL_STATUS[status]}".`,
      }));
      return false;
    }
    setErroSalvamento((e) => ({ ...e, [documentoId]: "" }));
    try {
      // STC-497 (achado do usuário: status escolhido aqui ficava preso em
      // "Não iniciado" mesmo depois de "Salvar"): documento criado em lote
      // nasce em "Não iniciado" e este PATCH é quem de fato aplica o
      // status escolhido -- sem este flag, a máquina de estados do
      // backend (pensada pra proteger edição de um documento com fluxo
      // real em andamento) barrava pular direto pra "Regular"/"Protocolado"/
      // "Vencido", só permitindo "Em andamento".
      await atualizarDocumentoLegalizacao(documentoId, {
        status,
        validade: validade || null,
        definindo_status_inicial: true,
      });
      return true;
    } catch (erro) {
      setErroSalvamento((e) => ({ ...e, [documentoId]: extrairMensagemErro(erro) }));
      return false;
    }
  }

  // STC-531 (achado do usuário: "Salvar" por item era fácil de esquecer,
  // deixando o status preso em "Não iniciado" mesmo com evidência já
  // anexada): "Concluir" passa a SER o "salvar tudo" -- roda a mesma
  // validação/PATCH de salvarStatusEValidade pra cada item de uma vez, e só
  // fecha o diálogo se todos confirmarem sucesso. Item incompleto (sem
  // status, ou Regular/Protocolado sem evidência) reprova aqui e mantém o
  // diálogo aberto, mostrando o erro embaixo do item -- mesma função que já
  // fazia essa validação, só que agora chamada pra todo mundo de uma vez,
  // não só quando alguém lembrava de clicar num botão por item.
  async function concluir() {
    if (!documentosCriados || concluindo) return;
    setConcluindo(true);
    const resultados = await Promise.all(
      documentosCriados.map((documento) => salvarStatusEValidade(documento.id)),
    );
    setConcluindo(false);
    if (resultados.every(Boolean)) {
      fechar();
    } else {
      toast.error(
        "Existem itens que não puderam ser salvos -- veja os erros de cada um antes de concluir.",
      );
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
    // STC-531 (achado do usuário): "Concluir" passou a ser o "salvar tudo"
    // -- não dá mais pra sair deste passo com um item sem status escolhido
    // (nem "Não iniciado" explícito, que é uma opção real do Select).
    // "Regular"/"Protocolado" continuam exigindo evidência (STC-524), sem
    // mudança. Trava preemptiva aqui (desabilita o botão) -- a validação de
    // verdade roda dentro de concluir(), acionada pelas 4 formas de fechar
    // (ver onOpenChange abaixo), não só por este botão.
    const algumItemIncompleto = documentosCriados.some((documento) => {
      const statusDoItem = statusPorItem[documento.id] ?? "";
      if (!statusDoItem) return true;
      return (
        STATUS_EXIGE_EVIDENCIA.has(statusDoItem as StatusDocumento) &&
        statusEnvio[documento.id] !== "enviado"
      );
    });

    return (
      <Dialog open={open} onOpenChange={(valor) => !valor && void concluir()}>
        <DialogContent className="flex max-h-[85vh] max-w-[min(30rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>Anexar evidências</DialogTitle>
          </DialogHeader>

          <div className="scrollbar-discreta flex-1 space-y-3 overflow-y-auto px-6 py-5">
            <p className="text-sm text-muted-foreground">
              Status e validade são por item -- cada equipamento pode ter sua
              própria data de calibração. &quot;Concluir&quot; salva o status
              de todo item de uma vez (mesmo que seja só
              &quot;Não iniciado&quot;) -- escolha um status pra cada um antes
              de sair. Evidência é opcional pros status
              &quot;Não iniciado&quot;/&quot;Em andamento&quot;/&quot;Vencido&quot;
              -- dá pra completar depois, um por um, na Matriz de
              Conformidade. Já pra &quot;Regular&quot; e
              &quot;Protocolado&quot;, o anexo é obrigatório antes de
              concluir.
            </p>
            {documentosCriados.map((documento) => {
              // STC-524: "Regular"/"Protocolado" pressupõem documento em
              // mãos -- só esses dois exigem evidência antes de liberar
              // "Concluir". Os outros 3 status continuam opcionais, como já
              // era pra todo mundo antes desta issue.
              const statusDoItem = statusPorItem[documento.id] ?? "";
              const faltaAnexoObrigatorio =
                STATUS_EXIGE_EVIDENCIA.has(statusDoItem as StatusDocumento) &&
                statusEnvio[documento.id] !== "enviado";
              return (
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
                    status={statusDoItem}
                    validade={validadePorItem[documento.id] ?? ""}
                    erro={erroSalvamento[documento.id]}
                    onStatusChange={(valor) =>
                      setStatusPorItem((s) => ({ ...s, [documento.id]: valor }))
                    }
                    onValidadeChange={(valor) =>
                      setValidadePorItem((v) => ({ ...v, [documento.id]: valor }))
                    }
                  />
                  {faltaAnexoObrigatorio && (
                    <p className="text-xs text-destructive">
                      Anexo obrigatório pra status &quot;
                      {LABEL_STATUS[statusDoItem as StatusDocumento]}&quot;.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button
              onClick={() => void concluir()}
              disabled={algumItemIncompleto || concluindo}
            >
              {concluindo ? "Concluindo..." : "Concluir"}
            </Button>
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

            <div className="space-y-1.5">
              <Label htmlFor="cel-responsaveis">
                Responsável(is) <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="responsaveis"
                render={({ field }) => (
                  <SeletorResponsaveis
                    id="cel-responsaveis"
                    unidadeId={unidadeSelecionada}
                    tipoDocumentoId={tipoDocumentoSelecionado}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.responsaveis && (
                <p className="text-xs text-destructive">
                  {errors.responsaveis.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Vale para todos os documentos deste lote.
              </p>
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
                  Data de início dos alertas{" "}
                  <span className="text-destructive">*</span>
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
                <Label htmlFor="cel-antecedencia">Antecedência (dias)</Label>
                {/* STC-523: padronizado em 60 pra toda a rede (decisão de
                negócio) -- deixou de ser um input editável. Exceção só via
                Django Admin, direto no banco. */}
                <Input
                  id="cel-antecedencia"
                  type="number"
                  min={0}
                  disabled
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
// linha independente da outra). STC-531: sem botão "Salvar" próprio --
// "Concluir" (rodapé do diálogo) salva todo item de uma vez, acionado
// pelas 4 formas de fechar o diálogo.
function LinhaStatusValidade({
  documentoId,
  status,
  validade,
  erro,
  onStatusChange,
  onValidadeChange,
}: {
  documentoId: number;
  status: StatusDocumento | "";
  validade: string;
  erro: string | undefined;
  onStatusChange: (valor: StatusDocumento) => void;
  onValidadeChange: (valor: string) => void;
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
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
