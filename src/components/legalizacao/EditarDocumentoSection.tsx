"use client";

import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
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
import { useAtualizarDocumentoLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import {
  CLASSE_CAMPO_IDENTIFICADOR,
  normalizarIdentificador,
  usaIdentificador,
} from "@/lib/identificadorDocumento";
import { LABEL_STATUS } from "@/lib/legalizacaoMatriz";
import { hojeISO } from "@/lib/utils";
import type { DocumentoUnidade, StatusDocumento } from "@/types/legalizacao";

// Mesma lista de FormCadastrarDocumento.tsx/FormCadastrarDocumentosEmLote.tsx
// -- sem Não aplicável/Unidade em encerramento, que já têm fluxo dedicado
// nesta mesma tela ("Marcar como Não aplicável"/"Reverter"). Editar aqui não
// duplica esses botões, só cobre os 5 status "normais". Desde a STC-833,
// qualquer um deles vai para qualquer outro, com justificativa.
const STATUS_EDITAVEIS: StatusDocumento[] = [
  "nao_iniciado",
  "em_andamento",
  "protocolado",
  "regular",
  "vencido",
];

// A renovação em curso do documento, se houver: Regular à mão a conclui
// junto (STC-833), exceto a de lote, que só anda pelo lote.
export interface RenovacaoAberta {
  emLote: boolean;
}

const MENSAGEM_LOTE =
  "A renovação deste documento faz parte de um lote: conclua pelo lote ou retire o item dele antes.";

// Regras iguais às do backend (DocumentoUnidadeWriteSerializer.validate e
// DocumentoUnidadeViewSet.update), conferidas aqui para não precisar ir ao
// servidor; as mensagens do backend também caem no campo certo
// (errosPorCampo, abaixo).
function criarSchema(
  exigeIdentificador: boolean,
  statusAtual: StatusDocumento,
  renovacaoAberta: RenovacaoAberta | null,
) {
  const vaiParaRegular = (status: StatusDocumento) =>
    status === "regular" && statusAtual !== "regular";
  return z
    .object({
      status: z.enum(STATUS_EDITAVEIS as [StatusDocumento, ...StatusDocumento[]], {
        error: "Selecione o status.",
      }),
      validade: z.string().optional(),
      profissional: z.string(),
      justificativa: z.string().max(2000, "Máximo de 2000 caracteres."),
    })
    // Mesma regra de FormCadastrarDocumento.tsx/DocumentoUnidadeWriteSerializer
    // (backend): "Vencido" sempre exige validade.
    .refine((v) => v.status !== "vencido" || !!v.validade, {
      message: "Obrigatória para status 'Vencido'.",
      path: ["validade"],
    })
    .refine((v) => !exigeIdentificador || normalizarIdentificador(v.profissional) !== "", {
      message: "Obrigatório para este tipo de documento.",
      path: ["profissional"],
    })
    .refine((v) => v.status === statusAtual || v.justificativa.trim() !== "", {
      message: "Obrigatória para mudar o status.",
      path: ["justificativa"],
    })
    .refine((v) => !vaiParaRegular(v.status) || !renovacaoAberta?.emLote, {
      message: MENSAGEM_LOTE,
      path: ["status"],
    })
    // Sem isso, a varredura da madrugada devolveria o documento para Vencido.
    .refine((v) => !vaiParaRegular(v.status) || !v.validade || v.validade >= hojeISO(), {
      message: "A validade está vencida: atualize a validade para marcar como Regular.",
      path: ["validade"],
    })
    .refine((v) => !vaiParaRegular(v.status) || !renovacaoAberta || !!v.validade, {
      message: "Informe a nova validade para concluir a renovação.",
      path: ["validade"],
    });
}

type FormValues = z.infer<ReturnType<typeof criarSchema>>;

function valoresDe(documento: DocumentoUnidade): FormValues {
  return {
    // Achado no dogfooding: abrir o modo de edição num documento em Não
    // aplicável/Unidade em encerramento (status fora de STATUS_EDITAVEIS)
    // não pode deixar o Select controlado sem nenhuma opção batendo --
    // cai em "nao_iniciado" como valor de partida, o usuário escolhe o
    // status real a partir daí (reverter esses dois status já tem seu
    // próprio botão dedicado, "Reverter para aplicável").
    status: (STATUS_EDITAVEIS as string[]).includes(documento.status)
      ? (documento.status as StatusDocumento)
      : "nao_iniciado",
    validade: documento.validade ?? "",
    profissional: documento.profissional,
    justificativa: "",
  };
}

// Campo do backend -> campo do formulário que mostra a mensagem.
const CAMPO_DO_FORMULARIO = {
  profissional: "profissional",
  status: "status",
  validade: "validade",
  justificativa_status: "justificativa",
} as const;

// Erro 400 do backend separado em duas partes: as mensagens dos campos do
// formulário (ex.: identificador repetido, item de lote, validade vencida),
// mostradas no próprio campo, e as demais, que vão para o aviso.
function separarErrosPorCampo(erro: unknown): {
  porCampo: [keyof FormValues, string][];
  outras: string[];
} | null {
  if (!isAxiosError(erro) || erro.response?.status !== 400) return null;
  const dados = erro.response.data as Record<string, unknown> | undefined;
  if (!dados) return null;
  const porCampo: [keyof FormValues, string][] = [];
  const outras: string[] = [];
  for (const [campo, mensagens] of Object.entries(dados)) {
    const textos = [mensagens]
      .flat()
      .filter((m): m is string => typeof m === "string" && m.trim() !== "");
    const doFormulario = CAMPO_DO_FORMULARIO[campo as keyof typeof CAMPO_DO_FORMULARIO];
    if (doFormulario && textos.length > 0) porCampo.push([doFormulario, textos[0]]);
    else outras.push(...textos);
  }
  return porCampo.length > 0 ? { porCampo, outras } : null;
}

export function EditarDocumentoSection({
  documento,
  renovacaoAberta = null,
  ativo,
  aoAbrir,
  aoCancelar,
  aoSalvar,
}: {
  documento: DocumentoUnidade;
  renovacaoAberta?: RenovacaoAberta | null;
  ativo: boolean;
  aoAbrir: () => void;
  aoCancelar: () => void;
  aoSalvar: () => void;
}) {
  const { atualizar, isLoading } = useAtualizarDocumentoLegalizacao();
  const comIdentificador = usaIdentificador(documento.tipo_documento);
  const emLote = renovacaoAberta?.emLote ?? null;
  const schema = useMemo(
    () =>
      criarSchema(
        comIdentificador,
        documento.status,
        emLote === null ? null : { emLote },
      ),
    [comIdentificador, documento.status, emLote],
  );
  // Valores à espera da confirmação de concluir a renovação junto.
  const [aConfirmar, setAConfirmar] = useState<FormValues | null>(null);
  // "Profissional" na Dosimetria (controlado por profissional); nos tipos de
  // múltiplas instâncias (equipamentos), o nome do item.
  const rotuloIdentificador = documento.tipo_documento.controlado_por_profissional
    ? "Profissional"
    : "Identificador";

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresDe(documento),
  });

  // Repopula com os valores atuais toda vez que o formulário abre -- mesmo
  // padrão de EditarDemandaSection.tsx (Gestão de Demandas).
  useEffect(() => {
    if (ativo) reset(valoresDe(documento));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  // Resincroniza com o servidor se `documento` mudar por baixo (polling) e o
  // usuário ainda não tiver mexido em nada -- mesmo achado de
  // EditarDemandaSection.tsx.
  useEffect(() => {
    if (ativo && !isDirty) reset(valoresDe(documento));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documento]);

  const mudouStatus = watch("status") !== documento.status;

  function aoSubmeter(valores: FormValues) {
    // Regular à mão com a renovação aberta conclui a renovação (STC-833):
    // confirma antes, porque o card do Kanban vai junto para Concluído.
    if (
      renovacaoAberta &&
      valores.status === "regular" &&
      documento.status !== "regular"
    ) {
      setAConfirmar(valores);
      return;
    }
    void enviar(valores);
  }

  async function enviar(valores: FormValues) {
    const statusMudou = valores.status !== documento.status;
    try {
      const atualizado = await atualizar({
        id: documento.id,
        payload: {
          status: valores.status,
          validade: valores.validade || null,
          ...(statusMudou && { justificativa_status: valores.justificativa.trim() }),
          ...(comIdentificador && {
            profissional: normalizarIdentificador(valores.profissional),
          }),
        },
      });
      toast.success(
        atualizado?.renovacao_concluida_junto
          ? "Documento atualizado. A renovação foi concluída junto, e o card foi para Concluído."
          : "Documento atualizado.",
      );
      aoSalvar();
    } catch (erro) {
      const separado = separarErrosPorCampo(erro);
      if (separado) {
        for (const [campo, mensagem] of separado.porCampo) setError(campo, { message: mensagem });
        if (separado.outras.length > 0) toast.error(separado.outras.join(" "));
        return;
      }
      toast.error(extrairMensagemErro(erro));
    }
  }

  if (!ativo) {
    return (
      <button
        type="button"
        onClick={aoAbrir}
        aria-label="Editar documento"
        className="flex items-center gap-1 text-[12.5px] font-medium text-secondary hover:underline"
      >
        <Pencil className="size-3" />
        Editar
      </button>
    );
  }

  return (
    <form
      onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
      className="flex flex-col gap-3 rounded-md border border-border p-2.5"
    >
      {comIdentificador && (
        <div className="space-y-1">
          <Label
            htmlFor="ed-doc-identificador"
            className="text-[10.5px] font-bold tracking-wide uppercase"
          >
            {rotuloIdentificador}
          </Label>
          <Input
            id="ed-doc-identificador"
            className={`h-8 text-[13px] ${CLASSE_CAMPO_IDENTIFICADOR}`}
            aria-invalid={!!errors.profissional}
            {...register("profissional")}
          />
          {errors.profissional && (
            <p className="text-xs text-destructive">{errors.profissional.message}</p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label
          htmlFor="ed-doc-status"
          className="text-[10.5px] font-bold tracking-wide uppercase"
        >
          Status
        </Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger id="ed-doc-status" size="sm" className="h-8 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              {/* position="popper": mesmo achado de EditarDemandaSection.tsx
                  -- o padrão "item-aligned" não calcula altura direito
                  dentro do contêiner com scroll próprio do modal. */}
              <SelectContent position="popper">
                {STATUS_EDITAVEIS.map((valor) => (
                  <SelectItem key={valor} value={valor}>
                    {LABEL_STATUS[valor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.status && (
          <p className="text-xs text-destructive">{errors.status.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label
          htmlFor="ed-doc-validade"
          className="text-[10.5px] font-bold tracking-wide uppercase"
        >
          Validade
        </Label>
        <Input
          id="ed-doc-validade"
          type="date"
          className="h-8 text-[13px]"
          {...register("validade")}
        />
        {errors.validade && (
          <p className="text-xs text-destructive">{errors.validade.message}</p>
        )}
      </div>

      {mudouStatus && (
        <div className="space-y-1">
          <Label
            htmlFor="ed-doc-justificativa"
            className="text-[10.5px] font-bold tracking-wide uppercase"
          >
            Justificativa
          </Label>
          <Textarea
            id="ed-doc-justificativa"
            rows={2}
            className="text-[13px]"
            aria-invalid={!!errors.justificativa}
            aria-describedby="ed-doc-justificativa-dica"
            {...register("justificativa")}
          />
          <p id="ed-doc-justificativa-dica" className="text-[11px] text-muted-foreground">
            Por que o status mudou. Fica registrada no histórico do documento.
          </p>
          {errors.justificativa && (
            <p className="text-xs text-destructive">{errors.justificativa.message}</p>
          )}
        </div>
      )}

      <div className="flex gap-1.5">
        <Button type="submit" size="xs" className="flex-1" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" size="xs" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
      </div>

      <ConfirmDialog
        open={aConfirmar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setAConfirmar(null);
        }}
        titulo="Concluir a renovação junto?"
        descricao="Este documento tem uma renovação em andamento. Ela será concluída junto, e o card no Kanban vai para Concluído."
        textoConfirmar="Marcar como Regular"
        onConfirmar={() => {
          const valores = aConfirmar;
          setAConfirmar(null);
          if (valores) void enviar(valores);
        }}
      />
    </form>
  );
}
