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

// Mesmo shape de FormNovaDemanda.tsx, sem tipo_gestao/unidade -- não são
// editáveis por aqui.
const schema = z.object({
  titulo: z.string().trim().min(1, "Título é obrigatório.").max(329, "Máximo de 329 caracteres."),
  descricao: z.string().trim().min(1, "Descrição é obrigatória."),
  prioridade: z.enum(["urgente", "alta", "media", "baixa"], {
    error: "Selecione a prioridade.",
  }),
  setor: z.coerce.number().int().positive().optional(),
  categoria: z.coerce.number().int().positive().optional(),
  data_prevista: z.string().min(1, "Prazo é obrigatório."),
  confidencial: z.boolean(),
});

type FormValuesEntrada = z.input<typeof schema>;
type FormValuesSaida = z.output<typeof schema>;

const PRIORIDADES: Prioridade[] = ["urgente", "alta", "media", "baixa"];

function valoresDe(demanda: Demanda): FormValuesEntrada {
  return {
    titulo: demanda.titulo,
    descricao: demanda.descricao,
    prioridade: demanda.prioridade,
    setor: demanda.setor?.id,
    categoria: demanda.categoria?.id,
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
    formState: { errors },
  } = useForm<FormValuesEntrada, unknown, FormValuesSaida>({
    resolver: zodResolver(schema),
    defaultValues: valoresDe(demanda),
  });

  // Repopula com os valores atuais toda vez que o formulário abre -- o
  // inverso do reset-ao-fechar de FormNovaDemanda (aqui é edição, não
  // criação: precisa partir do que já existe, não de um formulário vazio).
  useEffect(() => {
    if (ativo) reset(valoresDe(demanda));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  async function aoSubmeter(valores: FormValuesSaida) {
    try {
      await atualizar({
        titulo: valores.titulo,
        descricao: valores.descricao,
        prioridade: valores.prioridade,
        setor: valores.setor ?? null,
        categoria: valores.categoria ?? null,
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
        <Label className="text-[10.5px] font-bold tracking-wide uppercase">Prioridade</Label>
        <Controller
          control={control}
          name="prioridade"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger size="sm" className="h-8 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
        <Label className="text-[10.5px] font-bold tracking-wide uppercase">Setor</Label>
        <Controller
          control={control}
          name="setor"
          render={({ field }) => (
            <Select
              value={field.value ? String(field.value) : undefined}
              onValueChange={(valor) => field.onChange(Number(valor))}
            >
              <SelectTrigger size="sm" className="h-8 w-full text-[13px]">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
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

      {/* Mesmo critério de FormNovaDemanda: sem sentido escolher entre uma
          única categoria. */}
      {categorias.length > 1 && (
        <div className="space-y-1">
          <Label className="text-[10.5px] font-bold tracking-wide uppercase">Categoria</Label>
          <Controller
            control={control}
            name="categoria"
            render={({ field }) => (
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(valor) => field.onChange(Number(valor))}
              >
                <SelectTrigger size="sm" className="h-8 w-full text-[13px]">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
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
