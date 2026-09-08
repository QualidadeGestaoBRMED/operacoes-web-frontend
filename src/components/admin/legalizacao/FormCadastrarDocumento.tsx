"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip, Plus, X } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useCriarDocumentoLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { useCriarRegraDocumento } from "@/hooks/useRegrasDocumento";
import { useTiposDocumento } from "@/hooks/useTiposDocumento";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import {
  enviarEvidenciaLegalizacao,
  listarDocumentosLegalizacao,
} from "@/lib/legalizacao";
import { LABEL_CRITICIDADE, LABEL_STATUS } from "@/lib/legalizacaoMatriz";
import type { Criticidade, StatusDocumento } from "@/types/legalizacao";

// Exclui Não aplicável (é o toggle abaixo, não uma opção deste select) e
// Unidade em encerramento (fora do escopo desta issue -- ação de nível
// unidade, não de cadastro documento a documento).
const STATUS_INICIAIS: StatusDocumento[] = [
  "nao_iniciado",
  "em_andamento",
  "protocolado",
  "regular",
  "vencido",
];

const CRITICIDADES: Criticidade[] = ["baixa", "media", "alta"];

// z.coerce.number() sozinho transforma "" (campo em branco) em 0, não
// undefined -- .optional() nunca entra em ação, e o campo "opcional" falhava
// a validação de min(1) mesmo vazio. preprocess intercepta "" antes da
// coerção, pra .optional() de fato funcionar.
const numeroDiaOpcional = z.preprocess(
  (valor) => (valor === "" ? undefined : valor),
  z.coerce.number().int().min(1).max(31).optional(),
);

const schema = z
  .object({
    unidade: z.coerce
      .number({ error: "Selecione a unidade." })
      .int()
      .positive(),
    tipo_documento: z.coerce
      .number({ error: "Selecione o tipo de documento." })
      .int()
      .positive(),
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
    criticidade: z
      .enum(CRITICIDADES as [Criticidade, ...Criticidade[]])
      .optional(),
    gera_card_demanda: z.boolean(),
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
  .refine((v) => v.nao_aplicavel || !!v.criticidade, {
    message: "Selecione a criticidade.",
    path: ["criticidade"],
  })
  // Mesma regra de validate() (backend): "Vencido" sempre exige validade,
  // criação inclusa.
  .refine((v) => v.nao_aplicavel || v.status !== "vencido" || !!v.validade, {
    message: "Obrigatória para status 'Vencido'.",
    path: ["validade"],
  });

type FormValuesEntrada = z.input<typeof schema>;
type FormValuesSaida = z.output<typeof schema>;

const valoresPadrao: Partial<FormValuesEntrada> = {
  nao_aplicavel: false,
  gera_card_demanda: true,
};

export function FormCadastrarDocumento({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { unidades } = useUnidades();
  const { tiposDocumento } = useTiposDocumento();
  const { criar: criarRegra } = useCriarRegraDocumento();
  const { criar: criarDocumento } = useCriarDocumentoLegalizacao();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const tiposAtivos = tiposDocumento.filter((tipo) => tipo.ativo);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValuesEntrada, unknown, FormValuesSaida>({
    resolver: zodResolver(schema),
    defaultValues: valoresPadrao,
  });

  useEffect(() => {
    if (!open) {
      reset(valoresPadrao);
      setArquivo(null);
    }
  }, [open, reset]);

  const naoAplicavel = watch("nao_aplicavel");
  const status = watch("status");

  async function aoSubmeter(valores: FormValuesSaida) {
    setSalvando(true);
    try {
      // Achado no dogfooding: sem checar antes, uma tentativa repetida pro
      // mesmo tipo+unidade criava uma regra nova (etapa 1) que colidia com a
      // regra órfã da tentativa anterior (mesma vigente_a_partir) -- o
      // usuário via um erro técnico de unicidade da Regra em vez de um
      // aviso claro de "documento já existe". Checa aqui, antes de criar
      // qualquer coisa.
      const existentes = await listarDocumentosLegalizacao({
        unidade: valores.unidade,
        tipo_documento: valores.tipo_documento,
      });
      if (existentes.length > 0) {
        toast.error(
          'Já existe um documento cadastrado para esta unidade e tipo -- use "Corrigir regra existente" para atualizar.',
        );
        return;
      }

      if (valores.nao_aplicavel) {
        await criarDocumento({
          tipo_documento: valores.tipo_documento,
          unidade: valores.unidade,
          status: "nao_aplicavel",
          justificativa_excecao: valores.justificativa_excecao,
        });
      } else {
        // 1) Regra própria da unidade -- 2) documento, já com a regra recém
        // criada aplicada -- 3) evidência, se anexada. Único fluxo, 3
        // chamadas em sequência (não existe endpoint combinado no backend).
        const regra = await criarRegra({
          tipo_documento: valores.tipo_documento,
          unidade: valores.unidade,
          antecedencia_dias: valores.antecedencia_dias as number,
          janela_dia_inicio: valores.janela_dia_inicio ?? null,
          janela_dia_fim: valores.janela_dia_fim ?? null,
          criticidade: valores.criticidade as Criticidade,
          vigente_a_partir: valores.vigente_a_partir as string,
          gera_card_demanda: valores.gera_card_demanda,
        });
        const documento = await criarDocumento({
          tipo_documento: valores.tipo_documento,
          unidade: valores.unidade,
          status: valores.status as StatusDocumento,
          validade: valores.validade || null,
          regra_aplicada: regra.id,
        });
        if (arquivo) {
          setEnviandoArquivo(true);
          try {
            await enviarEvidenciaLegalizacao(documento.id, arquivo);
          } finally {
            setEnviandoArquivo(false);
          }
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
                    onValueChange={(valor) => field.onChange(Number(valor))}
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
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(valor) => field.onChange(Number(valor))}
                  >
                    <SelectTrigger id="cd-tipo" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposAtivos.map((tipo) => (
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
            </div>

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
                          value={field.value}
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
                    Sem herança -- os valores abaixo valem só para esta
                    combinação de tipo de documento e unidade.
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
                      Janela -- dia início
                    </Label>
                    <Input
                      id="cd-janela-inicio"
                      type="number"
                      min={1}
                      max={31}
                      {...register("janela_dia_inicio")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cd-janela-fim">Janela -- dia fim</Label>
                    <Input
                      id="cd-janela-fim"
                      type="number"
                      min={1}
                      max={31}
                      {...register("janela_dia_fim")}
                    />
                  </div>
                </div>
                <p className="-mt-2 text-xs text-muted-foreground">
                  Preencha só quando o tipo de documento tiver uma janela fixa
                  de atualização no mês (ex.: CNES).
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="cd-criticidade">
                    Criticidade <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="criticidade"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="cd-criticidade" className="w-full">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CRITICIDADES.map((valor) => (
                            <SelectItem key={valor} value={valor}>
                              {LABEL_CRITICIDADE[valor]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.criticidade && (
                    <p className="text-xs text-destructive">
                      {errors.criticidade.message}
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
                    accept=".pdf,.doc,.docx,.pptx,.xlsx,.png,.jpg,.jpeg"
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
                : "Cadastrar documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
