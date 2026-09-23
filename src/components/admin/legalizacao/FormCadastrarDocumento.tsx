"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip, Plus, X } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  useCriarDocumentoLegalizacao,
  useDocumentosLegalizacao,
} from "@/hooks/useDocumentosLegalizacao";
import { useCriarRegraDocumento } from "@/hooks/useRegrasDocumento";
import { useTiposDocumento } from "@/hooks/useTiposDocumento";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import {
  enviarEvidenciaLegalizacao,
  listarDocumentosLegalizacao,
} from "@/lib/legalizacao";
import { excluirRegraDocumento } from "@/lib/legalizacaoCatalogo";
import { LABEL_STATUS } from "@/lib/legalizacaoMatriz";
import type { StatusDocumento } from "@/types/legalizacao";

// Exclui Não aplicável (é o toggle abaixo, não uma opção deste select) e
// Unidade em encerramento (fora do escopo desta issue -- ação de nível
// unidade, não de cadastro documento a documento). Inclui Vencido de
// propósito, além dos 4 status do critério de aceite original: ao montar o
// esqueleto de uma unidade já existente, é comum que um documento já esteja
// vencido no dia do cadastro (decisão do planejamento desta issue).
const STATUS_INICIAIS: StatusDocumento[] = [
  "nao_iniciado",
  "em_andamento",
  "protocolado",
  "regular",
  "vencido",
];

// z.coerce.number() sozinho transforma "" (campo em branco) em 0, não
// undefined -- .optional() nunca entra em ação, e o campo "opcional" falhava
// a validação de min(1) mesmo vazio. preprocess intercepta "" antes da
// coerção, pra .optional() de fato funcionar.
const numeroDiaOpcional = z.preprocess(
  (valor) => (valor === "" ? undefined : valor),
  z.coerce.number().int().min(1).max(31).optional(),
);

// STC-432: schema vira função do conjunto de tipos controlado_por_profissional
// (Dosimetria hoje) -- "profissional" só é exigido quando o tipo escolhido
// tiver essa flag (espelha DocumentoUnidadeWriteSerializer.validate() no
// backend, que exige/proíbe o campo pela mesma flag). Não dá pra expressar
// isso com um .refine() estático porque a flag mora no objeto do tipo
// (useTiposDocumento), não em outro campo do próprio formulário.
function criarSchema(idsControladosPorProfissional: Set<number>) {
  return z
    .object({
      unidade: z.coerce
        .number({ error: "Selecione a unidade." })
        .int()
        .positive(),
      tipo_documento: z.coerce
        .number({ error: "Selecione o tipo de documento." })
        .int()
        .positive(),
      profissional: z.string().optional(),
      nao_aplicavel: z.boolean(),
      justificativa_excecao: z.string().optional(),
      status: z
        .enum(STATUS_INICIAIS as [StatusDocumento, ...StatusDocumento[]])
        .optional(),
      validade: z.string().optional(),
      vigente_a_partir: z.string().optional(),
      antecedencia_dias: z.coerce.number().int().min(0).optional(),
      janela_dia_inicio: numeroDiaOpcional,
      janela_dia_fim: numeroDiaOpcional,
      gera_card_demanda: z.boolean(),
      // STC-516/STC-517: obrigatório mesmo no caminho "Não aplicável" -- o
      // backend exige responsaveis em toda criação, sem exceção por status.
      responsaveis: z
        .array(z.number())
        .min(1, "Selecione pelo menos 1 responsável."),
    })
    // Espelha DocumentoUnidadeWriteSerializer.validate() (backend) -- ver
    // legalizacao/serializers.py: os 4 campos abaixo só são exigidos quando
    // NÃO é o caminho "Não aplicável".
    .refine((v) => !v.nao_aplicavel || !!v.justificativa_excecao, {
      message: "Obrigatória para marcar Não aplicável.",
      path: ["justificativa_excecao"],
    })
    .refine((v) => v.nao_aplicavel || !!v.status, {
      message: "Selecione o status inicial.",
      path: ["status"],
    })
    .refine((v) => v.nao_aplicavel || !!v.vigente_a_partir, {
      message: "Obrigatório.",
      path: ["vigente_a_partir"],
    })
    .refine((v) => v.nao_aplicavel || v.antecedencia_dias !== undefined, {
      message: "Obrigatória.",
      path: ["antecedencia_dias"],
    })
    // Mesma regra de validate() (backend): "Vencido" sempre exige validade,
    // criação inclusa.
    .refine((v) => v.nao_aplicavel || v.status !== "vencido" || !!v.validade, {
      message: "Obrigatória para status 'Vencido'.",
      path: ["validade"],
    })
    // Espelha DocumentoUnidadeWriteSerializer.validate() (backend):
    // "profissional" obrigatório pra tipos controlados por profissional...
    .refine(
      (v) =>
        !idsControladosPorProfissional.has(v.tipo_documento) ||
        !!v.profissional?.trim(),
      {
        message: "Obrigatório para este tipo de documento.",
        path: ["profissional"],
      },
    )
    // ...e proibido pros demais -- sem isso, um valor digitado antes de
    // trocar pra um tipo comum passaria batido no client e só falharia no
    // servidor.
    .refine(
      (v) =>
        idsControladosPorProfissional.has(v.tipo_documento) ||
        !v.profissional?.trim(),
      {
        message: "Só pode ser preenchido para tipos controlados por profissional.",
        path: ["profissional"],
      },
    );
}

type FormValuesEntrada = z.input<ReturnType<typeof criarSchema>>;
type FormValuesSaida = z.output<ReturnType<typeof criarSchema>>;

const valoresPadrao: Partial<FormValuesEntrada> = {
  nao_aplicavel: false,
  gera_card_demanda: true,
  responsaveis: [],
};

export function FormCadastrarDocumento({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, isCoordenacaoUnidade } = useAuth();
  const { unidades: todasAsUnidades } = useUnidades("padrao");
  // STC-514: mesmo critério da STC-512 -- Coordenador só pode cadastrar na
  // própria unidade, o seletor abaixo oferece só essa opção.
  const unidades = isCoordenacaoUnidade
    ? todasAsUnidades.filter((unidade) => unidade.id === user?.unidade_id)
    : todasAsUnidades;
  const { tiposDocumento } = useTiposDocumento();
  const { criar: criarRegra } = useCriarRegraDocumento();
  const { criar: criarDocumento } = useCriarDocumentoLegalizacao();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Achado no dogfooding: regra e documento já tinham sido criados com
  // sucesso quando só o envio da evidência falhava (arquivo grande, rede) --
  // o form mostrava um erro genérico e reabrir do zero esbarrava no cheque
  // de duplicidade, sem nenhum jeito de só reenviar a evidência que faltou.
  // Guardando o documento já criado, um novo clique em "Cadastrar documento"
  // reenvia só a evidência, em vez de tentar recriar tudo.
  const [documentoCriado, setDocumentoCriado] = useState<{ id: number } | null>(
    null,
  );
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const tiposAtivos = tiposDocumento.filter((tipo) => tipo.ativo);
  const idsControladosPorProfissional = useMemo(
    () =>
      new Set(
        tiposDocumento
          .filter((tipo) => tipo.controlado_por_profissional)
          .map((tipo) => tipo.id),
      ),
    [tiposDocumento],
  );
  const schema = useMemo(
    () => criarSchema(idsControladosPorProfissional),
    [idsControladosPorProfissional],
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

  useEffect(() => {
    if (!open) {
      reset(valoresPadrao);
      setArquivo(null);
      setDocumentoCriado(null);
    }
  }, [open, reset]);

  // STC-514: seletor de unidade travado na do Coordenador -- sem opção de
  // escolher outra (senão ele recebe 403 ao submeter, já que o backend só
  // permite escrever na própria). Depende de `open` pra reaplicar toda vez
  // que o form reabre (fechar reseta `unidade` pra undefined acima).
  useEffect(() => {
    if (!open || !isCoordenacaoUnidade || !user?.unidade_id) return;
    setValue("unidade", user.unidade_id);
  }, [open, isCoordenacaoUnidade, user?.unidade_id, setValue]);

  const naoAplicavel = watch("nao_aplicavel");
  const status = watch("status");
  const unidadeSelecionada = watch("unidade") as number | undefined;
  const tipoDocumentoSelecionado = watch("tipo_documento") as
    | number
    | undefined;
  const tipoSelecionado = tiposDocumento.find(
    (tipo) => tipo.id === tipoDocumentoSelecionado,
  );

  // Achado no dogfooding: só avisar depois de preencher o formulário
  // inteiro (no submit) que a combinação já existe era tarde demais -- nem
  // deixa escolher um tipo já cadastrado nesta unidade, em vez de barrar só
  // no fim. Continua tendo o mesmo cheque no submit (ver aoSubmeter) como
  // rede de segurança contra o cadastro ter mudado entre abrir o form e
  // enviar.
  const { documentos: documentosDaUnidade } = useDocumentosLegalizacao(
    { unidade: unidadeSelecionada },
    { desabilitado: !unidadeSelecionada },
  );
  const idsTiposJaCadastrados = new Set(
    documentosDaUnidade.map((documento) => documento.tipo_documento.id),
  );
  // STC-432: tipos controlado_por_profissional (Dosimetria) continuam
  // disponíveis mesmo já cadastrados -- cada profissional é uma linha
  // própria, então "já tem um documento deste tipo" não esgota a unidade
  // pra esses tipos (a checagem real de duplicata vira por profissional,
  // ver aoSubmeter).
  const tiposDisponiveis = tiposAtivos.filter(
    (tipo) =>
      tipo.controlado_por_profissional ||
      !idsTiposJaCadastrados.has(tipo.id),
  );

  // STC-432 (achado em análise própria de falhas críticas): pra um 2º+
  // profissional do mesmo tipo controlado_por_profissional nesta unidade, a
  // regra é reaproveitada em aoSubmeter (RegraDocumento não varia por
  // profissional) -- sem isto, o formulário continuava pedindo/mostrando os
  // campos de regra como se fossem criar uma regra nova, e qualquer valor
  // digitado ali era descartado em silêncio no submit, sem nenhum aviso.
  const regraExistenteParaTipo =
    tipoSelecionado?.controlado_por_profissional && tipoDocumentoSelecionado
      ? (documentosDaUnidade.find(
          (doc) =>
            doc.tipo_documento.id === tipoDocumentoSelecionado &&
            doc.regra_aplicada,
        )?.regra_aplicada ?? null)
      : null;

  useEffect(() => {
    if (!regraExistenteParaTipo) return;
    setValue("vigente_a_partir", regraExistenteParaTipo.vigente_a_partir);
    setValue("antecedencia_dias", regraExistenteParaTipo.antecedencia_dias);
    setValue(
      "janela_dia_inicio",
      regraExistenteParaTipo.janela_dia_inicio ?? undefined,
    );
    setValue(
      "janela_dia_fim",
      regraExistenteParaTipo.janela_dia_fim ?? undefined,
    );
    setValue("gera_card_demanda", regraExistenteParaTipo.gera_card_demanda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regraExistenteParaTipo?.id, setValue]);

  // Achado no code review automático (STC-432): o efeito acima só preenche
  // os campos de regra quando regraExistenteParaTipo existe -- ele nunca os
  // limpa quando deixa de existir (troca de unidade/tipo saindo de um tipo
  // controlado com regra já cadastrada pra outro sem regra). Sem isto, os
  // valores da regra anterior ficavam visíveis e editáveis, prontos pra ir
  // no submit como se fossem da regra nova.
  function limparCamposDeRegra() {
    setValue("vigente_a_partir", undefined);
    setValue("antecedencia_dias", undefined);
    setValue("janela_dia_inicio", undefined);
    setValue("janela_dia_fim", undefined);
    setValue("gera_card_demanda", valoresPadrao.gera_card_demanda ?? true);
    // STC-488 (achado em avaliação de uso): esta função limpava só os
    // campos de regra -- status/validade/justificativa_excecao/nao_aplicavel
    // sobreviviam silenciosamente à troca de unidade/tipo. Um documento
    // cadastrado como "Vencido" com validade preenchida, seguido de troca
    // pra outro tipo de documento no mesmo formulário, mantinha esses
    // valores prontos pra ir no submit como se fossem do documento novo.
    setValue("status", undefined);
    setValue("validade", undefined);
    setValue("justificativa_excecao", undefined);
    setValue("nao_aplicavel", valoresPadrao.nao_aplicavel ?? false);
    // STC-517: candidatos a responsável dependem de unidade+tipo -- um
    // responsável válido pra combinação anterior pode não ser candidato
    // pra nova (outra unidade, ou outro setor de apoio).
    setValue("responsaveis", []);
  }

  // Extraído do fluxo principal -- também usado quando o usuário clica
  // "Cadastrar documento" de novo depois de um envio de evidência que já
  // falhou uma vez (documentoCriado setado): regra e documento já existem,
  // só falta reenviar o arquivo.
  async function enviarEvidenciaDoDocumento(documentoId: number) {
    setEnviandoArquivo(true);
    try {
      await enviarEvidenciaLegalizacao(documentoId, arquivo as File);
      toast.success("Documento cadastrado.");
      onOpenChange(false);
    } catch (erro) {
      // Não relança -- documento e regra já existem de verdade, isto não é
      // uma falha do cadastro em si. Fica com documentoCriado setado pra um
      // novo clique só reenviar a evidência, em vez de tentar recriar tudo
      // (o que esbarraria no cheque de duplicidade).
      toast.error(
        `Documento cadastrado, mas o envio da evidência falhou: ${extrairMensagemErro(erro)}. Clique em "Cadastrar documento" de novo para tentar reenviar.`,
      );
    } finally {
      setEnviandoArquivo(false);
    }
  }

  async function aoSubmeter(valores: FormValuesSaida) {
    setSalvando(true);
    try {
      if (documentoCriado) {
        // Achado em code review: evidência é opcional -- se o usuário
        // removeu o arquivo depois de um envio que falhou, não há mais o
        // que reenviar. Sem este cheque, "arquivo as File" mandava null
        // pra enviarEvidenciaLegalizacao, virando uma chamada inválida ao
        // backend.
        if (!arquivo) {
          toast.success("Documento cadastrado.");
          onOpenChange(false);
          return;
        }
        await enviarEvidenciaDoDocumento(documentoCriado.id);
        return;
      }

      const tipoControladoPorProfissional = idsControladosPorProfissional.has(
        valores.tipo_documento,
      );

      // Achado no dogfooding: sem checar antes, uma tentativa repetida pro
      // mesmo tipo+unidade criava uma regra nova (etapa 1) que colidia com a
      // regra órfã da tentativa anterior (mesma vigente_a_partir) -- o
      // usuário via um erro técnico de unicidade da Regra em vez de um
      // aviso claro de "documento já existe". Checa aqui, antes de criar
      // qualquer coisa.
      //
      // STC-432: pra tipos controlado_por_profissional, a duplicata real é
      // por profissional (mesmo tipo+unidade com profissionais diferentes é
      // esperado, uma linha por profissional) -- só bloqueia se o MESMO
      // profissional já tiver documento deste tipo nesta unidade.
      //
      // trim() aqui (achado em análise própria de falhas críticas): sem
      // isso, " Dr. João" e "Dr. João" (o valor já salvo, sempre trimado no
      // envio) não batiam nessa comparação, deixando passar uma duplicata
      // real por causa só de espaço em branco.
      const profissionalTrimado = valores.profissional?.trim() ?? "";
      const existentes = await listarDocumentosLegalizacao({
        unidade: valores.unidade,
        tipo_documento: valores.tipo_documento,
      });
      const duplicado = tipoControladoPorProfissional
        ? existentes.some(
            (documento) => documento.profissional === profissionalTrimado,
          )
        : existentes.length > 0;
      if (duplicado) {
        toast.error(
          tipoControladoPorProfissional
            ? "Já existe um documento deste tipo e unidade para este profissional."
            : 'Já existe um documento cadastrado para esta unidade e tipo. Use "Corrigir regra existente" para atualizar.',
        );
        return;
      }

      if (valores.nao_aplicavel) {
        await criarDocumento({
          tipo_documento: valores.tipo_documento,
          unidade: valores.unidade,
          status: "nao_aplicavel",
          justificativa_excecao: valores.justificativa_excecao,
          responsaveis: valores.responsaveis,
          ...(tipoControladoPorProfissional && {
            profissional: profissionalTrimado,
          }),
        });
      } else {
        // STC-432: regra é por tipo+unidade, nunca por profissional (prazo/
        // antecedência não variam entre profissionais do mesmo tipo) -- se
        // já existe uma regra de uma linha anterior deste tipo+unidade
        // (outro profissional), reaproveita em vez de criar outra, que
        // colidiria com a UniqueConstraint (tipo_documento, unidade,
        // vigente_a_partir) no backend.
        const regraExistente = existentes.find(
          (documento) => documento.regra_aplicada,
        )?.regra_aplicada;
        // 1) Regra própria da unidade (ou reaproveitada) -- 2) documento,
        // com a regra aplicada -- 3) evidência, se anexada. Único fluxo, no
        // máximo 3 chamadas em sequência (não existe endpoint combinado no
        // backend).
        const regra =
          regraExistente ??
          (await criarRegra({
            tipo_documento: valores.tipo_documento,
            unidade: valores.unidade,
            antecedencia_dias: valores.antecedencia_dias as number,
            janela_dia_inicio: valores.janela_dia_inicio ?? null,
            janela_dia_fim: valores.janela_dia_fim ?? null,
            // STC-486: não é mais escolhido no formulário -- na prática todo
            // documento cadastrado recebia "Alta" mesmo, então fixa o valor
            // em vez de pedir pro usuário (sem mudança no backend, "alta"
            // já é um choice válido de RegraDocumento.criticidade).
            criticidade: "alta",
            vigente_a_partir: valores.vigente_a_partir as string,
            gera_card_demanda: valores.gera_card_demanda,
          }));
        let documento;
        try {
          documento = await criarDocumento({
            tipo_documento: valores.tipo_documento,
            unidade: valores.unidade,
            status: valores.status as StatusDocumento,
            validade: valores.validade || null,
            regra_aplicada: regra.id,
            responsaveis: valores.responsaveis,
            ...(tipoControladoPorProfissional && {
              profissional: profissionalTrimado,
            }),
          });
        } catch (erroDocumento) {
          // A regra já foi criada com sucesso -- se o documento falhar
          // (ex.: alguém cadastrou a mesma combinação nesse meio-tempo),
          // desfaz a regra órfã em vez de deixar lixo no catálogo. Best
          // effort: se a própria exclusão falhar, ignora e mostra o erro
          // original (que é o que importa pro usuário).
          //
          // STC-432: só desfaz se a regra foi criada agora -- uma regra
          // reaproveitada (regraExistente) já está em uso por outro
          // documento (outro profissional do mesmo tipo/unidade), excluí-la
          // quebraria aquele documento também.
          if (!regraExistente) {
            try {
              await excluirRegraDocumento(regra.id);
            } catch {
              // Ignora.
            }
          }
          throw erroDocumento;
        }
        if (arquivo) {
          setDocumentoCriado({ id: documento.id });
          await enviarEvidenciaDoDocumento(documento.id);
          return;
        }
      }
      toast.success("Documento cadastrado.");
      onOpenChange(false);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[min(34rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Cadastrar documento</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="scrollbar-discreta flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {documentoCriado && (
              <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {arquivo
                  ? "O documento já foi cadastrado. Falta só reenviar a evidência; os outros campos abaixo não têm mais efeito."
                  : "O documento já foi cadastrado, sem evidência. Anexe um arquivo se quiser, ou clique em Concluir; os outros campos abaixo não têm mais efeito."}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cd-unidade">
                Unidade <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="unidade"
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(valor) => {
                      field.onChange(Number(valor));
                      // Tipo escolhido antes pode não valer mais pra unidade
                      // nova (já cadastrado nela, ou nem essa era a lista
                      // filtrada que ele viu) -- força reescolha.
                      setValue(
                        "tipo_documento",
                        undefined as unknown as number,
                      );
                      // Achado em análise própria de falhas críticas: sem
                      // isto, um profissional digitado pra Unidade A
                      // sobrevivia silenciosamente à troca pra Unidade B --
                      // fácil de não notar e cadastrar o documento errado
                      // pro profissional errado.
                      setValue("profissional", "");
                      limparCamposDeRegra();
                    }}
                  >
                    <SelectTrigger id="cd-unidade" className="w-full">
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
                <p className="text-xs text-destructive">
                  {errors.unidade.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cd-tipo">
                Tipo de documento <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="tipo_documento"
                render={({ field }) => (
                  <Select
                    // STC-488 (achado nesta issue): "" no lugar de
                    // `undefined` -- mesmo motivo do Select de status
                    // abaixo, sem isso o Radix trocava de controlado pra
                    // não-controlado ao limpar (troca de unidade) e o
                    // trigger ficava preso no último tipo selecionado.
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(valor) => {
                      field.onChange(Number(valor));
                      // Mesmo motivo da troca de unidade acima -- um
                      // profissional digitado pra um tipo não deve
                      // sobreviver silenciosamente à troca pra outro tipo.
                      setValue("profissional", "");
                      limparCamposDeRegra();
                    }}
                    disabled={!unidadeSelecionada}
                  >
                    <SelectTrigger id="cd-tipo" className="w-full">
                      <SelectValue
                        placeholder={
                          unidadeSelecionada
                            ? "Selecionar..."
                            : "Escolha a unidade primeiro"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Só os tipos que esta unidade ainda não tem
                          cadastrados -- não deixa nem escolher uma
                          combinação que já existe, em vez de barrar só no
                          submit. */}
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
              {unidadeSelecionada && tiposDisponiveis.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Todos os tipos de documento ativos já foram cadastrados para
                  esta unidade.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Responsável(is) <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="responsaveis"
                render={({ field }) => (
                  <SeletorResponsaveis
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
            </div>

            {tipoSelecionado?.controlado_por_profissional && (
              <div className="space-y-1.5">
                <Label htmlFor="cd-profissional">
                  Profissional <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cd-profissional"
                  placeholder="Nome do profissional"
                  {...register("profissional")}
                />
                {errors.profissional && (
                  <p className="text-xs text-destructive">
                    {errors.profissional.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Este tipo de documento é controlado por profissional -- cada
                  profissional tem uma linha própria nesta unidade.
                </p>
              </div>
            )}

            <Separator />

            <label className="flex items-center gap-2 text-sm font-medium">
              <Controller
                control={control}
                name="nao_aplicavel"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              Não aplicável a esta unidade
            </label>

            {naoAplicavel ? (
              <div className="space-y-1.5">
                <Label htmlFor="cd-justificativa">
                  Justificativa <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="cd-justificativa"
                  {...register("justificativa_excecao")}
                  placeholder="Por que este tipo de documento não se aplica a esta unidade?"
                />
                {errors.justificativa_excecao && (
                  <p className="text-xs text-destructive">
                    {errors.justificativa_excecao.message}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cd-status">
                      Status inicial <span className="text-destructive">*</span>
                    </Label>
                    <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <Select
                          // STC-488 (achado nesta issue): `value={field.value}`
                          // sozinho fazia o Select do Radix trocar de
                          // controlado pra não-controlado quando o valor
                          // limpava pra `undefined` (troca de tipo) -- o
                          // texto exibido no trigger ficava preso no último
                          // valor selecionado, mesmo com o form já limpo por
                          // baixo. `?? ""` mantém sempre controlado.
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="cd-status" className="w-full">
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
                      )}
                    />
                    {errors.status && (
                      <p className="text-xs text-destructive">
                        {errors.status.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cd-validade">
                      Validade{" "}
                      {status === "vencido" && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    <Input
                      id="cd-validade"
                      type="date"
                      {...register("validade")}
                    />
                    {errors.validade && (
                      <p className="text-xs text-destructive">
                        {errors.validade.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Regra desta unidade
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {regraExistenteParaTipo
                      ? "Este tipo é controlado por profissional e já tem uma regra cadastrada nesta unidade (reaproveitada de outro profissional) -- os campos abaixo só mostram os valores já em vigor, não editáveis aqui."
                      : "Os valores abaixo valem só para esta unidade e este tipo de documento. Cada unidade tem seu próprio prazo, mesmo sendo o mesmo tipo de documento."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cd-vigente">
                      Vigente a partir{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cd-vigente"
                      type="date"
                      disabled={!!regraExistenteParaTipo}
                      {...register("vigente_a_partir")}
                    />
                    {errors.vigente_a_partir && (
                      <p className="text-xs text-destructive">
                        {errors.vigente_a_partir.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cd-antecedencia">
                      Antecedência (dias){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cd-antecedencia"
                      type="number"
                      min={0}
                      disabled={!!regraExistenteParaTipo}
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
                    <Label htmlFor="cd-janela-inicio">
                      Início da janela (dia)
                    </Label>
                    <Input
                      id="cd-janela-inicio"
                      type="number"
                      min={1}
                      max={31}
                      disabled={!!regraExistenteParaTipo}
                      {...register("janela_dia_inicio")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cd-janela-fim">Fim da janela (dia)</Label>
                    <Input
                      id="cd-janela-fim"
                      type="number"
                      min={1}
                      max={31}
                      disabled={!!regraExistenteParaTipo}
                      {...register("janela_dia_fim")}
                    />
                  </div>
                </div>
                <p className="-mt-2 text-xs text-muted-foreground">
                  Preencha só quando o tipo de documento tiver uma janela fixa
                  de atualização no mês (ex.: CNES).
                </p>

                <label className="flex items-center gap-2 text-sm">
                  <Controller
                    control={control}
                    name="gera_card_demanda"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        disabled={!!regraExistenteParaTipo}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  Gerar card em Gestão de Demandas quando o processo de
                  renovação começar
                </label>

                <div className="space-y-1.5">
                  <Label>Evidência</Label>
                  <input
                    ref={inputArquivoRef}
                    type="file"
                    // STC-433: restrito a PDF -- o backend (validar_arquivo,
                    // core/arquivos.py) já rejeita qualquer outra extensão
                    // para evidências de Legalização.
                    accept=".pdf"
                    className="hidden"
                    onChange={(evento) =>
                      setArquivo(evento.target.files?.[0] ?? null)
                    }
                  />
                  {arquivo ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {arquivo.name}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remover ${arquivo.name}`}
                        onClick={() => {
                          setArquivo(null);
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
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border-1.5 border-dashed border-border text-[13px] font-medium text-muted-foreground transition-colors hover:border-secondary hover:text-secondary"
                    >
                      <Plus className="size-3.5" />
                      Anexar evidência (opcional)
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando
                ? enviandoArquivo
                  ? "Enviando evidência..."
                  : "Cadastrando..."
                : documentoCriado
                  ? arquivo
                    ? "Reenviar evidência"
                    : "Concluir"
                  : "Cadastrar documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
