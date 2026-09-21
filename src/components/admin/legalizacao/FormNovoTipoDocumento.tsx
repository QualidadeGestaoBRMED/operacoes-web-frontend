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
import {
  useAtualizarTipoDocumento,
  useCriarTipoDocumento,
} from "@/hooks/useTiposDocumento";
import { extrairMensagemErro } from "@/lib/erros";
import { LABEL_CATEGORIA, ORDEM_CATEGORIA } from "@/lib/legalizacaoMatriz";
import type {
  AreaResponsavelDocumento,
  TipoDocumentoRegulatorio,
} from "@/types/legalizacao";

// Espelha TipoDocumentoRegulatorio.AreaResponsavel (backend/legalizacao/
// models.py) -- só 2 valores, sem hook/endpoint próprio (é um choices fixo,
// igual Categoria).
const ROTULO_AREA_RESPONSAVEL: Record<AreaResponsavelDocumento, string> = {
  legalizacao: "Legalização",
  coordenacao: "Coordenação da Unidade",
};

// Mesmo regex de um SlugField do Django (letras minúsculas, números e
// hífen) -- confere no client o que o backend já rejeitaria via
// TipoDocumentoRegulatorio.codigo (SlugField, unique).
const REGEX_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  nome: z.string().min(1, "Nome é obrigatório."),
  codigo: z
    .string()
    .min(1, "Código é obrigatório.")
    .regex(
      REGEX_SLUG,
      "Use só letras minúsculas, números e hífen (ex.: licenca-sanitaria).",
    ),
  categoria: z.enum(
    [
      "regularizacao",
      "registros_tecnicos",
      "capacitacao",
      "infraestrutura",
      "equipamentos",
      "programas",
      "residuos",
    ],
    { error: "Selecione a categoria." },
  ),
  area_responsavel: z.enum(["legalizacao", "coordenacao"], {
    error: "Selecione a área responsável.",
  }),
  exige_validade: z.boolean(),
  exige_protocolo: z.boolean(),
  exige_evidencia: z.boolean(),
  permite_multiplas_instancias: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// Espelha os defaults de TipoDocumentoRegulatorio (backend/legalizacao/
// models.py): exige_validade/exige_evidencia nascem ligados, exige_protocolo
// nasce desligado -- maioria dos ~31 itens do catálogo seed segue esse
// padrão (licença/alvará tem validade e evidência, protocolo é exceção).
const valoresPadrao: Partial<FormValues> = {
  exige_validade: true,
  exige_protocolo: false,
  exige_evidencia: true,
  permite_multiplas_instancias: false,
};

// STC-501: mesmo diálogo cadastra (tipoDocumento ausente) e edita
// (tipoDocumento presente) -- evita duplicar o formulário inteiro só pra
// trocar POST por PATCH. `codigo` fica travado em modo edição: é usado
// como chave fixa em código (CODIGOS_MOVIMENTACAO_PROFISSIONAL,
// legalizacaoMatriz.ts) pra CNES/Dosimetria/etc. -- mudar o código de um
// tipo já em uso quebraria esses comportamentos silenciosamente, e o
// pedido real do cliente é sobre o Nome (capitalização inconsistente),
// não o código interno.
function valoresDe(tipo: TipoDocumentoRegulatorio): FormValues {
  return {
    nome: tipo.nome,
    codigo: tipo.codigo,
    categoria: tipo.categoria,
    area_responsavel: tipo.area_responsavel,
    exige_validade: tipo.exige_validade,
    exige_protocolo: tipo.exige_protocolo,
    exige_evidencia: tipo.exige_evidencia,
    permite_multiplas_instancias: tipo.permite_multiplas_instancias,
  };
}

export function FormNovoTipoDocumento({
  open,
  onOpenChange,
  tipoDocumento,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Ausente/null: modo cadastro (padrão). Presente: modo edição.
  tipoDocumento?: TipoDocumentoRegulatorio | null;
}) {
  const emEdicao = !!tipoDocumento;
  const { criar, isLoading: criando } = useCriarTipoDocumento();
  const { atualizar, isLoading: atualizando } = useAtualizarTipoDocumento();
  const isLoading = emEdicao ? atualizando : criando;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: valoresPadrao,
  });

  useEffect(() => {
    if (!open) {
      reset(valoresPadrao);
    } else if (tipoDocumento) {
      reset(valoresDe(tipoDocumento));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipoDocumento?.id]);

  async function aoSubmeter(valores: FormValues) {
    try {
      if (tipoDocumento) {
        await atualizar({ id: tipoDocumento.id, payload: valores });
        toast.success("Tipo de documento atualizado.");
      } else {
        await criar(valores);
        toast.success("Tipo de documento cadastrado.");
      }
      onOpenChange(false);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[min(30rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>
            {emEdicao ? "Editar tipo de documento" : "Novo tipo de documento"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="scrollbar-discreta flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="td-nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="td-nome"
                {...register("nome")}
                placeholder="Ex.: Licença Sanitária"
              />
              {errors.nome && (
                <p className="text-xs text-destructive">
                  {errors.nome.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="td-codigo">
                Código <span className="text-destructive">*</span>
              </Label>
              <Input
                id="td-codigo"
                disabled={emEdicao}
                {...register("codigo")}
                placeholder="Ex.: licenca-sanitaria"
              />
              {errors.codigo && (
                <p className="text-xs text-destructive">
                  {errors.codigo.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {emEdicao
                  ? "Não pode ser alterado depois de criado -- é usado internamente pra reconhecer tipos como CNES/Dosimetria."
                  : "Um código interno do sistema, só pra identificar esse tipo de documento. Não aparece pra quem for usar o catálogo depois."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="td-categoria">
                Categoria <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="categoria"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="td-categoria" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDEM_CATEGORIA.map((categoria) => (
                        <SelectItem key={categoria} value={categoria}>
                          {LABEL_CATEGORIA[categoria]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoria && (
                <p className="text-xs text-destructive">
                  {errors.categoria.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="td-area">
                Área responsável <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="area_responsavel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="td-area" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(
                          ROTULO_AREA_RESPONSAVEL,
                        ) as AreaResponsavelDocumento[]
                      ).map((area) => (
                        <SelectItem key={area} value={area}>
                          {ROTULO_AREA_RESPONSAVEL[area]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.area_responsavel && (
                <p className="text-xs text-destructive">
                  {errors.area_responsavel.message}
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label>Exigências</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Controller
                    control={control}
                    name="exige_validade"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  Exige validade
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Controller
                    control={control}
                    name="exige_protocolo"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  Exige protocolo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Controller
                    control={control}
                    name="exige_evidencia"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  Exige evidência
                </label>
              </div>
            </div>

            <div className="space-y-2.5">
              <Label>Múltiplas instâncias por unidade</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Controller
                    control={control}
                    name="permite_multiplas_instancias"
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  Permite múltiplas instâncias
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Libera cadastro em lote (N documentos por unidade, ex.: um
                por equipamento). Não confundir com &ldquo;Controlado por
                profissional&rdquo; (Dosimetria) -- esse é outro mecanismo,
                que também liga o fluxo de Movimentação Profissional, e por
                isso não tem checkbox aqui: é uma decisão maior, fora do
                escopo deste cadastro.
              </p>
            </div>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {emEdicao
                ? isLoading
                  ? "Salvando..."
                  : "Salvar"
                : isLoading
                  ? "Cadastrando..."
                  : "Cadastrar tipo de documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
