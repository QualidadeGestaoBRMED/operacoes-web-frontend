"use client";

import { useEffect, useMemo } from "react";
import { isAxiosError } from "axios";
import { Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
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
import { useAtualizarDocumentoLegalizacao } from "@/hooks/useDocumentosLegalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import {
  CLASSE_CAMPO_IDENTIFICADOR,
  normalizarIdentificador,
  usaIdentificador,
} from "@/lib/identificadorDocumento";
import { LABEL_STATUS } from "@/lib/legalizacaoMatriz";
import type { DocumentoUnidade, StatusDocumento } from "@/types/legalizacao";

// Mesma lista de FormCadastrarDocumento.tsx/FormCadastrarDocumentosEmLote.tsx
// -- sem Não aplicável/Unidade em encerramento, que já têm fluxo dedicado
// nesta mesma tela ("Marcar como Não aplicável"/"Reverter"). Editar aqui não
// duplica esses botões, só cobre os 5 status "normais".
const STATUS_EDITAVEIS: StatusDocumento[] = [
  "nao_iniciado",
  "em_andamento",
  "protocolado",
  "regular",
  "vencido",
];

// Identificador obrigatório só nos tipos que usam identificador, como no
// cadastro (DocumentoUnidadeWriteSerializer.validate, backend).
function criarSchema(exigeIdentificador: boolean) {
  return z
    .object({
      status: z.enum(STATUS_EDITAVEIS as [StatusDocumento, ...StatusDocumento[]], {
        error: "Selecione o status.",
      }),
      validade: z.string().optional(),
      profissional: z.string(),
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
  };
}

// Erro 400 do backend separado em duas partes: a mensagem do identificador
// (ex.: nome repetido no mesmo tipo e unidade), mostrada no próprio campo, e
// as dos outros campos, que vão para o aviso.
function separarErroDoIdentificador(
  erro: unknown,
): { identificador: string; outras: string[] } | null {
  if (!isAxiosError(erro) || erro.response?.status !== 400) return null;
  const dados = erro.response.data as Record<string, unknown> | undefined;
  const doCampo = [dados?.profissional].flat().filter((m) => typeof m === "string");
  if (!dados || doCampo.length === 0) return null;
  const outras = Object.entries(dados)
    .filter(([campo]) => campo !== "profissional")
    .flatMap(([, mensagens]) => [mensagens].flat())
    .filter((m): m is string => typeof m === "string" && m.trim() !== "");
  return { identificador: doCampo[0] as string, outras };
}

export function EditarDocumentoSection({
  documento,
  ativo,
  aoAbrir,
  aoCancelar,
  aoSalvar,
}: {
  documento: DocumentoUnidade;
  ativo: boolean;
  aoAbrir: () => void;
  aoCancelar: () => void;
  aoSalvar: () => void;
}) {
  const { atualizar, isLoading } = useAtualizarDocumentoLegalizacao();
  const comIdentificador = usaIdentificador(documento.tipo_documento);
  const schema = useMemo(() => criarSchema(comIdentificador), [comIdentificador]);
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

  async function aoSubmeter(valores: FormValues) {
    try {
      await atualizar({
        id: documento.id,
        payload: {
          status: valores.status,
          validade: valores.validade || null,
          ...(comIdentificador && {
            profissional: normalizarIdentificador(valores.profissional),
          }),
        },
      });
      toast.success("Documento atualizado.");
      aoSalvar();
    } catch (erro) {
      const separado = comIdentificador ? separarErroDoIdentificador(erro) : null;
      if (separado) {
        setError("profissional", { message: separado.identificador });
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

      <div className="flex gap-1.5">
        <Button type="submit" size="xs" className="flex-1" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" size="xs" variant="ghost" onClick={aoCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
