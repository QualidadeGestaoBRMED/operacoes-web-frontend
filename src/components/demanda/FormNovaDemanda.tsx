"use client";

import { useEffect, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { useAuth } from "@/hooks/useAuth";
import { useCriarDemanda } from "@/hooks/useDemandaMutations";
import { useCategorias } from "@/hooks/useCategorias";
import { useSetores } from "@/hooks/useSetores";
import { useTiposGestao } from "@/hooks/useTiposGestao";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import { CODIGO_TIPO_GESTAO_OPERACIONAL, COR_PRIORIDADE, LABEL_PRIORIDADE } from "@/lib/kanban";
import { cn } from "@/lib/utils";
import type { Prioridade } from "@/types";
import { SeletorAreaResponsavel } from "./SeletorAreaResponsavel";
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
  // Mutuamente exclusivos -- qual dos dois é obrigatório depende do tipo de
  // gestão selecionado (codigo "operacional" usa area_responsavel, os
  // demais usam unidade). Os dois ficam opcionais aqui de propósito; a
  // obrigatoriedade condicional é aplicada em aoSubmeter, onde o código do
  // tipo de gestão selecionado já está disponível.
  unidade: z.coerce.number().int().positive().optional(),
  area_responsavel: z
    .array(z.enum(["gerencia", "processo", "qualidade", "desenvolvimento"]))
    .default([]),
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
  area_responsavel: [],
  confidencial: false,
};

export function FormNovaDemanda({
  open,
  onOpenChange,
  tipoGestaoInicial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Aba do Kanban ativa no momento em que "Nova Demanda" foi aberta (ver
  // KanbanBoard.tsx) -- pré-seleciona o Tipo de gestão em vez de forçar
  // escolher de novo algo que já estava implícito na tela de origem.
  tipoGestaoInicial?: number;
}) {
  const { user, isCoordenacaoUnidade } = useAuth();
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
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValuesEntrada, unknown, FormValuesSaida>({
    resolver: zodResolver(schema),
    defaultValues: valoresPadrao,
  });

  // Achado em produção (relato da Fernanda Fortino, STC-538): este efeito
  // reagia a QUALQUER mudança de `tipoGestaoInicial`, não só à abertura do
  // modal -- `tipoGestaoInicial` vem de `filtros.tipo_gestao`
  // (KanbanBoard.tsx), que é autocorrigido de forma ASSÍNCRONA sempre que o
  // tipo de gestão da URL deixa de ser válido pro perfil (mais comum pra
  // Coordenação de Unidade, que enxerga uma lista bem mais restrita que
  // Admin). Se essa autocorreção rodava com "Nova Demanda" já aberto, o
  // `reset()` disparava de novo e reescrevia o formulário INTEIRO (Unidade
  // incluída) pros valores padrão, em segundo plano -- o Select continuava
  // mostrando o valor antigo na tela, mas o estado real do formulário já
  // tinha sido zerado, fazendo o submit falhar com "Selecione a unidade."
  // mesmo com o campo aparentemente preenchido.
  //
  // Fix: só reagir à transição false -> true de `open` (guardada no ref
  // abaixo) -- uma mudança de `tipoGestaoInicial` com o modal já aberto não
  // reseta mais nada; a próxima abertura de verdade já usa o valor mais
  // recente (lido direto no corpo do efeito, não capturado antes).
  // Sempre começa em `false` (nunca `open`) -- se o componente já nascer
  // com `open=true` (não acontece hoje em KanbanBoard.tsx, mas é o caso de
  // todo teste deste arquivo), a 1ª execução do efeito precisa CONTAR como
  // abertura de verdade e aplicar tipoGestaoInicial, igual sempre fez.
  const abertoAnteriormenteRef = useRef(false);
  useEffect(() => {
    const abriuAgora = open && !abertoAnteriormenteRef.current;
    if (open) {
      if (abriuAgora) {
        reset({ ...valoresPadrao, tipo_gestao: tipoGestaoInicial });
      }
    } else {
      reset(valoresPadrao);
    }
    abertoAnteriormenteRef.current = open;
  }, [open, tipoGestaoInicial, reset]);

  // STC-538: mesmo padrão de Legalização (FormCadastrarDocumento.tsx) --
  // Coordenação de Unidade só pode abrir demanda pra própria unidade, então
  // nem oferece escolher outra (evita o mesmo tipo de erro relatado: menos
  // uma chance de "Selecione a unidade" por escolha errada ou perdida).
  // Efeito DECLARADO DEPOIS do de cima de propósito -- os dois rodam no
  // mesmo commit quando `open` vira true; o reset() de cima limpa `unidade`
  // antes deste preenchê-la, nunca na ordem inversa (que apagaria o valor
  // que este acabou de definir).
  useEffect(() => {
    if (!open || !isCoordenacaoUnidade || !user?.unidade_id) return;
    setValue("unidade", user.unidade_id);
  }, [open, isCoordenacaoUnidade, user?.unidade_id, setValue]);

  // Achado no review: SeletorEtiquetas usava tiposGestao[0]?.modulo (sempre
  // o primeiro da lista), não o módulo do tipo_gestao de fato selecionado
  // no formulário -- com mais de um tipo de gestão em módulos diferentes, a
  // tela mostrava/criava etiquetas do módulo errado e podia enviar IDs
  // incompatíveis com a demanda.
  const tipoGestaoSelecionadoId = useWatch({ control, name: "tipo_gestao" });
  const tipoGestaoSelecionado = tiposGestao.find(
    (tipo) => tipo.id === Number(tipoGestaoSelecionadoId),
  );
  const moduloSelecionado = tipoGestaoSelecionado?.modulo;
  const ehOperacional = tipoGestaoSelecionado?.codigo === CODIGO_TIPO_GESTAO_OPERACIONAL;
  // STC-510 (mesmo achado de KanbanFiltros.tsx): o Select de Unidade
  // precisa acompanhar a rede do tipo de gestão selecionado NO FORMULÁRIO
  // (não só o da aba de origem) -- o usuário pode trocar de tipo de gestão
  // sem fechar o modal.
  const { unidades: todasAsUnidades } = useUnidades(
    tipoGestaoSelecionado?.visibilidade_padrao === "opex" ? "opex" : "padrao",
  );
  // STC-538: Coordenação de Unidade só escolhe a própria unidade -- mesmo
  // critério de Legalização (FormCadastrarDocumento.tsx).
  const unidades = isCoordenacaoUnidade
    ? todasAsUnidades.filter((unidade) => unidade.id === user?.unidade_id)
    : todasAsUnidades;

  async function aoSubmeter(valores: FormValuesSaida) {
    // "unidade" e "area_responsavel" são mutuamente exclusivos -- qual dos
    // dois é obrigatório depende do tipo de gestão selecionado, então o
    // zod (estático) não valida isso sozinho.
    if (ehOperacional && valores.area_responsavel.length === 0) {
      setError("area_responsavel", { message: "Selecione ao menos uma área responsável." });
      return;
    }
    if (!ehOperacional && !valores.unidade) {
      setError("unidade", { message: "Selecione a unidade." });
      return;
    }
    try {
      await criar({
        titulo: valores.titulo,
        descricao: valores.descricao,
        tipo_gestao: valores.tipo_gestao,
        prioridade: valores.prioridade,
        unidade: ehOperacional ? null : (valores.unidade ?? null),
        // area_responsavel é M2M no backend (STC-391) -- lista vazia é um
        // valor válido pra "não se aplica" (o campo é required=False, sem
        // exigir null explícito nem omitir a chave, ao contrário do
        // CharField de antes).
        area_responsavel: ehOperacional ? valores.area_responsavel : [],
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
              {/* Demandas do tipo de gestão "Operacional" não representam uma
                  clínica -- usam area_responsavel em vez de unidade (pedido
                  da solicitante, P4). Os dois campos ocupam a mesma posição
                  no layout, nunca aparecem juntos. */}
              {ehOperacional ? (
                <div className="space-y-1.5">
                  <Label htmlFor="f-area-responsavel">
                    Área Responsável <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="area_responsavel"
                    render={({ field }) => (
                      <SeletorAreaResponsavel
                        id="f-area-responsavel"
                        value={field.value ?? []}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  {errors.area_responsavel && (
                    <p className="text-xs text-destructive">{errors.area_responsavel.message}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="f-unidade">
                    Unidade <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    control={control}
                    name="unidade"
                    render={({ field }) => (
                      // "" (não undefined) -- mesmo padrão de
                      // FormCadastrarDocumento.tsx (STC-488): evita o
                      // Select trocar de controlado pra não-controlado (e o
                      // warning correspondente) quando ainda não há
                      // unidade escolhida.
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(valor) => field.onChange(Number(valor))}
                      >
                        <SelectTrigger id="f-unidade" className="w-full">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent position="popper">
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
              )}

              <div className="space-y-1.5">
                <Label htmlFor="f-setor">Setor Origem</Label>
                <Controller
                  control={control}
                  name="setor"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={(valor) => field.onChange(Number(valor))}
                    >
                      <SelectTrigger id="f-setor" className="w-full">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      {/* position="popper" em todo Select deste formulário --
                          ver comentário equivalente em
                          EditarDemandaSection.tsx: o Dialog inteiro tem
                          scroll próprio, "item-aligned" (padrão) não calcula
                          altura disponível direito nesse caso. */}
                      <SelectContent position="popper">
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
                <Label htmlFor="f-tipo-gestao">
                  Tipo de gestão <span className="text-destructive">*</span>
                </Label>
                {/* Pré-preenchido com tipoGestaoInicial (aba ativa do Kanban)
                    ao abrir -- ver reset() no useEffect acima -- mas
                    continua editável, caso a demanda seja de um tipo
                    diferente do que a aba atual sugere. */}
                <Controller
                  control={control}
                  name="tipo_gestao"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={(valor) => {
                        field.onChange(Number(valor));
                        // Achado no review: etiquetas escolhidas ficavam
                        // "presas" no form ao trocar de tipo_gestao (e por
                        // tabela, de módulo) -- mesmo corrigindo o módulo
                        // exibido no seletor, os IDs antigos, de outro
                        // módulo, ainda eram enviados ocultamente no
                        // payload, causando associação errada ou 400.
                        setValue("etiquetas", []);
                        // Mesmo motivo: "unidade"/"area_responsavel" são
                        // mutuamente exclusivos por tipo de gestão -- sem
                        // isso, um valor escolhido antes da troca (pro campo
                        // que já não aparece mais) ficava preso e ia junto
                        // no payload.
                        setValue("unidade", undefined);
                        setValue("area_responsavel", []);
                      }}
                    >
                      <SelectTrigger id="f-tipo-gestao" className="w-full">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent position="popper">
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
                  <Label htmlFor="f-categoria">Categoria</Label>
                  <Controller
                    control={control}
                    name="categoria"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : undefined}
                        onValueChange={(valor) => field.onChange(Number(valor))}
                      >
                        <SelectTrigger id="f-categoria" className="w-full">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent position="popper">
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
                    modulo={moduloSelecionado}
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
