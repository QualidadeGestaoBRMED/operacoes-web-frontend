"use client";

import { useEffect } from "react";
import { Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useCategorias } from "@/hooks/useCategorias";
import { useAtualizarDemanda } from "@/hooks/useDemandaMutations";
import { useSetores } from "@/hooks/useSetores";
import { extrairMensagemErro } from "@/lib/erros";
import { COR_PRIORIDADE, LABEL_PRIORIDADE } from "@/lib/kanban";
import { cn } from "@/lib/utils";
import type { Demanda, Prioridade } from "@/types";
import { SeletorEtiquetas } from "./SeletorEtiquetas";

// Sentinela só de UI pro Select "desmarcar" -- nunca é enviado ao backend
// como se fosse um id real (Radix Select não aceita value="", e não pode
// colidir com nenhum id real, que o Select sempre recebe como string
// numérica). setor/categoria ficam como string simples aqui (SEM_SELECAO ou
// o id) -- nada de coerção/undefined no meio do valor controlado do Select
// (achado no review: um vaivém undefined <-> sentinela ali causava o
// Select mostrar a opção antiga mesmo depois de escolher "Nenhum", embora
// o valor real já estivesse certo por baixo). A tradução pra null só
// acontece no submit (aoSubmeter), fora do caminho de renderização.
const SEM_SELECAO = "__nenhum__";

// Mesmo shape de FormNovaDemanda.tsx, sem tipo_gestao/unidade -- não são
// editáveis por aqui.
const schema = z.object({
  titulo: z.string().trim().min(1, "Título é obrigatório.").max(329, "Máximo de 329 caracteres."),
  descricao: z.string().trim().min(1, "Descrição é obrigatória."),
  prioridade: z.enum(["urgente", "alta", "media", "baixa"], {
    error: "Selecione a prioridade.",
  }),
  setor: z.string(),
  categoria: z.string(),
  etiquetas: z.array(z.number()),
  data_prevista: z.string().min(1, "Prazo é obrigatório."),
  confidencial: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const PRIORIDADES: Prioridade[] = ["urgente", "alta", "media", "baixa"];

function valoresDe(demanda: Demanda): FormValues {
  return {
    titulo: demanda.titulo,
    descricao: demanda.descricao,
    prioridade: demanda.prioridade,
    setor: demanda.setor ? String(demanda.setor.id) : SEM_SELECAO,
    categoria: demanda.categoria ? String(demanda.categoria.id) : SEM_SELECAO,
    etiquetas: demanda.etiquetas.map((etiqueta) => etiqueta.id),
    data_prevista: demanda.data_prevista,
    confidencial: demanda.confidencial,
  };
}

export function EditarDemandaSection({
  demanda,
  podeEditar,
  ativo,
  aoAbrir,
  aoFechar,
}: {
  demanda: Demanda;
  podeEditar: boolean;
  ativo: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
}) {
  // Escopado ao módulo do tipo_gestao já definido na demanda -- mais preciso
  // que o fallback tiposGestao[0]?.modulo que FormNovaDemanda usa (lá ainda
  // não existe um tipo_gestao escolhido pra derivar disso).
  const { setores } = useSetores(demanda.tipo_gestao.modulo);
  const { categorias } = useCategorias();
  const { atualizar, isLoading } = useAtualizarDemanda(demanda.id);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresDe(demanda),
  });

  // Repopula com os valores atuais toda vez que o formulário abre -- o
  // inverso do reset-ao-fechar de FormNovaDemanda (aqui é edição, não
  // criação: precisa partir do que já existe, não de um formulário vazio).
  // Sempre incondicional (não olha isDirty): descarta qualquer "sujeira"
  // deixada por uma sessão anterior cancelada sem salvar.
  useEffect(() => {
    if (ativo) reset(valoresDe(demanda));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  // Achado no review: com o polling do STC-206, `demanda` pode mudar por
  // baixo do formulário já aberto (outra pessoa editando ao mesmo tempo) --
  // sem isso, o Salvar sobrescrevia essa mudança concorrente silenciosamente,
  // baseado num retrato desatualizado. Só resincroniza se o usuário ainda
  // não tiver mexido em nada (!isDirty) -- não descarta edição em andamento.
  useEffect(() => {
    if (ativo && !isDirty) reset(valoresDe(demanda));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demanda]);

  async function aoSubmeter(valores: FormValues) {
    try {
      await atualizar({
        titulo: valores.titulo,
        descricao: valores.descricao,
        prioridade: valores.prioridade,
        setor: valores.setor === SEM_SELECAO ? null : Number(valores.setor),
        categoria: valores.categoria === SEM_SELECAO ? null : Number(valores.categoria),
        etiquetas: valores.etiquetas,
        data_prevista: valores.data_prevista,
        confidencial: valores.confidencial,
      });
      toast.success("Demanda atualizada.");
      aoFechar();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  if (!podeEditar) return null;

  if (!ativo) {
    return (
      <button
        type="button"
        onClick={aoAbrir}
        className="flex items-center gap-1 text-[12.5px] font-medium text-secondary hover:underline"
      >
        <Pencil className="size-3" />
        Editar demanda
      </button>
    );
  }

  return (
    <form
      onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
      className="flex flex-col gap-3 rounded-md border border-border p-2.5"
    >
      <div className="space-y-1">
        <Label htmlFor="ed-titulo" className="text-[10.5px] font-bold tracking-wide uppercase">
          Título
        </Label>
        <Input id="ed-titulo" maxLength={329} className="h-8 text-[13px]" {...register("titulo")} />
        {errors.titulo && <p className="text-xs text-destructive">{errors.titulo.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="ed-prioridade" className="text-[10.5px] font-bold tracking-wide uppercase">
          Prioridade
        </Label>
        <Controller
          control={control}
          name="prioridade"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="ed-prioridade" size="sm" className="h-8 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {PRIORIDADES.map((prioridade) => (
                  <SelectItem key={prioridade} value={prioridade}>
                    <span className={cn("size-2 rounded-full", COR_PRIORIDADE[prioridade])} />
                    {LABEL_PRIORIDADE[prioridade]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.prioridade && (
          <p className="text-xs text-destructive">{errors.prioridade.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="ed-prazo" className="text-[10.5px] font-bold tracking-wide uppercase">
          Prazo
        </Label>
        <Input
          id="ed-prazo"
          type="date"
          className="h-8 text-[13px]"
          {...register("data_prevista")}
        />
        {errors.data_prevista && (
          <p className="text-xs text-destructive">{errors.data_prevista.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="ed-setor" className="text-[10.5px] font-bold tracking-wide uppercase">
          Setor Origem
        </Label>
        <Controller
          control={control}
          name="setor"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="ed-setor" size="sm" className="h-8 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              {/* position="popper" em todo Select desta tela: o padrão
                  "item-aligned" não calcula altura disponível direito
                  quando o trigger está dentro de um contêiner com scroll
                  próprio (o modal de detalhe) -- achado ao crescer "Setor
                  Origem" pra 20 opções, o próprio modal rolava junto em vez
                  de só a lista abrir com scroll interno. */}
              <SelectContent position="popper">
                <SelectItem value={SEM_SELECAO}>Nenhum</SelectItem>
                {setores.map((setor) => (
                  <SelectItem key={setor.id} value={String(setor.id)}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Achado no review do Tech Lead: o critério de FormNovaDemanda
          (esconder com <= 1 categoria, sem sentido "escolher" com uma única
          opção) não vale em edição -- aqui sempre existe algo real pra
          fazer mesmo com 1 categoria só: atribuí-la a uma demanda hoje sem
          categoria, ou limpar a categoria atual de volta pra "Nenhuma". Só
          esconde quando não há categoria nenhuma cadastrada (nada real pra
          escolher além do que já é o estado atual). */}
      {categorias.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="ed-categoria" className="text-[10.5px] font-bold tracking-wide uppercase">
            Categoria
          </Label>
          <Controller
            control={control}
            name="categoria"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="ed-categoria" size="sm" className="h-8 w-full text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={SEM_SELECAO}>Nenhuma</SelectItem>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.id} value={String(categoria.id)}>
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-[10.5px] font-bold tracking-wide uppercase">Etiquetas</Label>
        <Controller
          control={control}
          name="etiquetas"
          render={({ field }) => (
            <SeletorEtiquetas
              value={field.value}
              onChange={field.onChange}
              modulo={demanda.tipo_gestao.modulo}
            />
          )}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ed-descricao" className="text-[10.5px] font-bold tracking-wide uppercase">
          Descrição
        </Label>
        <Textarea id="ed-descricao" rows={3} className="text-[13px]" {...register("descricao")} />
        {errors.descricao && (
          <p className="text-xs text-destructive">{errors.descricao.message}</p>
        )}
      </div>

      <Controller
        control={control}
        name="confidencial"
        render={({ field }) => (
          <Label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            Demanda confidencial
          </Label>
        )}
      />

      <div className="flex gap-1.5">
        <Button type="submit" size="xs" className="flex-1" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" size="xs" variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
