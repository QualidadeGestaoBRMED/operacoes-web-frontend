"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useCriarDemanda } from "@/hooks/useDemandaMutations";
import { useCategorias } from "@/hooks/useCategorias";
import { useSetores } from "@/hooks/useSetores";
import { useTiposGestao } from "@/hooks/useTiposGestao";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import { COR_PRIORIDADE, LABEL_PRIORIDADE } from "@/lib/kanban";
import { cn } from "@/lib/utils";
import type { Prioridade } from "@/types";
import { SeletorEtiquetas } from "./SeletorEtiquetas";

// Título tem max_length=329 no model (Demanda.titulo) -- backend rejeitaria
// com 400 sem essa validação de propósito espelhada aqui.
const schema = z.object({
  titulo: z.string().trim().min(1, "Título é obrigatório.").max(329, "Máximo de 329 caracteres."),
  descricao: z.string().trim().min(1, "Descrição é obrigatória."),
  // Erro vai no z.coerce.number() em si, não só no .positive() -- sem
  // unidade/tipo_gestao selecionados, field.value é undefined, Number(undefined)
  // vira NaN, e isso já falha na coerção de base (antes de chegar em
  // .positive()) com a mensagem genérica do zod ("Invalid input: expected
  // number, received NaN") em vez da mensagem em português abaixo.
  tipo_gestao: z.coerce.number({ error: "Selecione o tipo de gestão." }).int().positive(),
  prioridade: z.enum(["urgente", "alta", "media", "baixa"], {
    error: "Selecione a prioridade.",
  }),
  unidade: z.coerce.number({ error: "Selecione a unidade." }).int().positive(),
  setor: z.coerce.number().int().positive().optional(),
  categoria: z.coerce.number().int().positive().optional(),
  etiquetas: z.array(z.number()).default([]),
  data_prevista: z.string().min(1, "Prazo é obrigatório."),
  confidencial: z.boolean(),
});

// z.coerce.number() faz o schema ter um tipo de ENTRADA (unknown, antes da
// coerção) diferente do de SAÍDA (number, depois) -- sem separar os dois
// aqui, o TypeScript não consegue casar o Resolver do zodResolver com o
// useForm (erro TS2322 -- acha que os campos coeridos deveriam ser number
// já na entrada).
type FormValuesEntrada = z.input<typeof schema>;
type FormValuesSaida = z.output<typeof schema>;

const PRIORIDADES: Prioridade[] = ["urgente", "alta", "media", "baixa"];

const valoresPadrao: Partial<FormValuesEntrada> = {
  titulo: "",
  descricao: "",
  etiquetas: [],
  confidencial: false,
};

export function FormNovaDemanda({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { unidades } = useUnidades();
  const { categorias } = useCategorias();
  const { tiposGestao } = useTiposGestao();
  // Setor não é module-scoped por URL (diferente de tipos-gestao/categorias)
  // -- reaproveita o modulo já carregado via TipoGestao (mesmo módulo,
  // "gestão de demandas") em vez de assumir/hardcodar um id.
  const { setores } = useSetores(tiposGestao[0]?.modulo);
  const { criar, isLoading } = useCriarDemanda();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValuesEntrada, unknown, FormValuesSaida>({
    resolver: zodResolver(schema),
    defaultValues: valoresPadrao,
  });

  // Reseta o formulário toda vez que o modal fecha -- sem isso, reabrir
  // "Nova Demanda" mostrava os dados da última tentativa (inclusive depois
  // de criar uma com sucesso).
  useEffect(() => {
    if (!open) reset(valoresPadrao);
  }, [open, reset]);

  async function aoSubmeter(valores: FormValuesSaida) {
    try {
      await criar({
        titulo: valores.titulo,
        descricao: valores.descricao,
        tipo_gestao: valores.tipo_gestao,
        prioridade: valores.prioridade,
        unidade: valores.unidade,
        setor: valores.setor ?? null,
        categoria: valores.categoria ?? null,
        etiquetas: valores.etiquetas,
        data_prevista: valores.data_prevista,
        confidencial: valores.confidencial,
      });
      toast.success("Demanda criada.");
      onOpenChange(false);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // max-w-[min(32rem,calc(100%-2rem))]: antes só limitava em sm:
        // (>=640px) -- abaixo disso caía no fallback padrão do Dialog
        // (calc(100%-2rem), quase edge-to-edge). Isso garante uma margem
        // mínima ao redor sempre, sem depender do usuário maximizar a janela,
        // e sem nunca passar do próprio viewport numa tela bem estreita.
        className="flex max-h-[85vh] max-w-[min(32rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Nova Demanda</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="scrollbar-discreta flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="f-titulo">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input id="f-titulo" maxLength={329} {...register("titulo")} />
              {errors.titulo && (
                <p className="text-xs text-destructive">{errors.titulo.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Prioridade <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="prioridade"
                render={({ field }) => (
                  <div className="grid grid-cols-4 gap-2">
                    {PRIORIDADES.map((prioridade) => (
                      <button
                        key={prioridade}
                        type="button"
                        onClick={() => field.onChange(prioridade)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-md border-2 border-border bg-background py-2.5 text-[11.5px] font-semibold text-muted-foreground uppercase transition-colors",
                          field.value === prioridade && "border-secondary text-secondary",
                        )}
                      >
                        <span className={cn("size-3 rounded-full", COR_PRIORIDADE[prioridade])} />
                        {LABEL_PRIORIDADE[prioridade]}
                      </button>
                    ))}
                  </div>
                )}
              />
              {errors.prioridade && (
                <p className="text-xs text-destructive">{errors.prioridade.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
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
                      <SelectTrigger className="w-full">
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
                <Label>Setor</Label>
                <Controller
                  control={control}
                  name="setor"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={(valor) => field.onChange(Number(valor))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar..." />
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
            </div>

            {/* grid-cols-1 quando Categoria não aparece -- senão Tipo de
                gestão ficava sozinho preso na coluna esquerda, com um vão
                vazio do lado direito. */}
            <div className={cn("grid gap-3", categorias.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
              <div className="space-y-1.5">
                <Label>
                  Tipo de gestão <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="tipo_gestao"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={(valor) => field.onChange(Number(valor))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposGestao.map((tipo) => (
                          <SelectItem key={tipo.id} value={String(tipo.id)}>
                            {tipo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.tipo_gestao && (
                  <p className="text-xs text-destructive">{errors.tipo_gestao.message}</p>
                )}
              </div>

              {/* Mesmo critério do KanbanFiltros: sem sentido escolher entre
                  uma única categoria -- só aparece quando houver mais de uma. */}
              {categorias.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Controller
                    control={control}
                    name="categoria"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : undefined}
                        onValueChange={(valor) => field.onChange(Number(valor))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecionar..." />
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
            </div>

            <div className="space-y-1.5">
              <Label>Etiquetas</Label>
              <Controller
                control={control}
                name="etiquetas"
                render={({ field }) => (
                  <SeletorEtiquetas
                    value={field.value ?? []}
                    onChange={field.onChange}
                    modulo={tiposGestao[0]?.modulo}
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-prazo">
                Prazo <span className="text-destructive">*</span>
              </Label>
              <Input id="f-prazo" type="date" {...register("data_prevista")} />
              {errors.data_prevista && (
                <p className="text-xs text-destructive">{errors.data_prevista.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-descricao">
                Descrição <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="f-descricao"
                rows={3}
                placeholder="Contexto adicional, passos necessários, referências..."
                {...register("descricao")}
              />
              {errors.descricao && (
                <p className="text-xs text-destructive">{errors.descricao.message}</p>
              )}
            </div>

            <Controller
              control={control}
              name="confidencial"
              render={({ field }) => (
                // Mesmo peso visual dos outros campos (borda + fundo) --
                // sozinho, um checkbox de 16px ficava visualmente perdido ao
                // lado dos Select/Input com borda grossa e sombra.
                <Label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-input bg-background px-3 py-2.5 transition-colors hover:bg-muted/40">
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  Demanda confidencial
                </Label>
              )}
            />
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Criando..." : "Criar Demanda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
