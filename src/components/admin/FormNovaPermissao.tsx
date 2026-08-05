"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { useModulos } from "@/hooks/useModulos";
import { useCriarPermissao } from "@/hooks/usePermissoes";
import { useSetores } from "@/hooks/useSetores";
import { useUnidades } from "@/hooks/useUnidades";
import { useUsuarios } from "@/hooks/useUsuarios";
import { extrairMensagemErro } from "@/lib/erros";
import { nomeExibicao } from "@/lib/utils";
import type { AcaoPermissao, EscopoPermissao } from "@/types";

type AcaoKanban = Extract<AcaoPermissao, "visualizar" | "editar">;

const ACOES: AcaoKanban[] = [
  "visualizar",
  "editar",
];

// recurso é texto livre no backend (PermissaoUsuario.recurso, sem choices),
// mas hoje só existe UM valor real em uso -- fixar como select em vez de
// input de texto evita erro de digitação (uma string que não bate com
// nenhuma checagem real do backend cria uma permissão "fantasma", sem
// efeito nenhum, sem nenhum erro avisando). Se um recurso novo aparecer no
// backend, precisa ser adicionado aqui também -- não tem como descobrir a
// lista dinamicamente hoje (não existe um catálogo consultável via API).
// Convenção "<código do módulo>.<recurso>" (ver Modulo.codigo, backend) --
// aoSubmeter usa o prefixo antes do "." pra achar o modulo_id certo e
// preencher PermissaoUsuario.modulo, sem precisar mapear aqui de novo. Um
// módulo novo só precisa de uma entrada aqui com o código dele como prefixo.
const RECURSOS: { valor: string; rotulo: string }[] = [
  { valor: "gestao-demandas.kanban", rotulo: "Gestão de Demandas -- Kanban" },
];

const ROTULO_ACAO: Record<AcaoPermissao, string> = {
  visualizar: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  aprovar: "Aprovar",
  excluir: "Excluir",
  restaurar: "Restaurar",
  configurar: "Configurar",
};

const ROTULO_ESCOPO: Record<EscopoPermissao, string> = {
  global: "Global (todas as unidades/setores)",
  unidade: "Uma unidade específica",
  setor: "Um setor específico",
  proprio: "Só onde a pessoa já está envolvida (solicitante/aprovador/responsável)",
};

// Mesmas validações condicionais de PermissaoUsuarioSerializer.validate()
// (backend/plataforma/serializers.py) -- espelhadas aqui pra não deixar o
// usuário só descobrir no 400 da API.
const schema = z
  .object({
    usuario: z.coerce.number({ error: "Selecione a pessoa." }).int().positive(),
    recurso: z.string().min(1, "Selecione o recurso."),
    // Uma escolha gera exatamente um PermissaoUsuario. "editar" já implica
    // leitura no backend, portanto não há motivo para criar também um
    // segundo registro "visualizar" e arriscar uma concessão parcial.
    acao: z.enum(["visualizar", "editar"], {
      error: "Selecione a ação.",
    }),
    escopo_tipo: z.enum(["global", "unidade", "setor", "proprio"], {
      error: "Selecione o escopo.",
    }),
    unidade: z.coerce.number().int().positive().optional(),
    setor: z.coerce.number().int().positive().optional(),
    data_inicio: z.string().min(1, "Data de início é obrigatória."),
    data_fim: z.string().optional(),
  })
  .refine((valores) => valores.escopo_tipo !== "unidade" || !!valores.unidade, {
    message: "Selecione a unidade.",
    path: ["unidade"],
  })
  .refine((valores) => valores.escopo_tipo !== "setor" || !!valores.setor, {
    message: "Selecione o setor.",
    path: ["setor"],
  })
  .refine(
    (valores) => !valores.data_fim || valores.data_fim >= valores.data_inicio,
    { message: "Data de fim não pode ser antes da data de início.", path: ["data_fim"] },
  );

type FormValuesEntrada = z.input<typeof schema>;
type FormValuesSaida = z.output<typeof schema>;

const valoresPadrao: Partial<FormValuesEntrada> = {
  acao: "visualizar",
  escopo_tipo: "unidade",
};

export function FormNovaPermissao({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { usuarios } = useUsuarios();
  const { unidades } = useUnidades();
  const { setores } = useSetores();
  const { modulos } = useModulos();
  const { criar, isLoading } = useCriarPermissao();

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
    if (!open) reset(valoresPadrao);
  }, [open, reset]);

  const escopoSelecionado = watch("escopo_tipo");

  async function aoSubmeter(valores: FormValuesSaida) {
    try {
      // recurso segue "<código do módulo>.<recurso>" -- acha o Modulo real
      // pelo prefixo (null se o módulo ainda não tiver linha em Modulo, ex.:
      // um dos "em breve" na Sidebar que só existe como config de frontend).
      const codigoModulo = valores.recurso.split(".")[0];
      const moduloId = modulos.find((modulo) => modulo.codigo === codigoModulo)?.id ?? null;

      await criar({
        usuario: valores.usuario,
        modulo: moduloId,
        recurso: valores.recurso,
        acao: valores.acao,
        escopo_tipo: valores.escopo_tipo,
        unidade: valores.escopo_tipo === "unidade" ? valores.unidade : null,
        setor: valores.escopo_tipo === "setor" ? valores.setor : null,
        data_inicio: valores.data_inicio,
        data_fim: valores.data_fim || null,
      });
      toast.success("Permissão concedida.");
      onOpenChange(false);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[min(32rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Conceder permissão</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="scrollbar-discreta flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="p-usuario">
                Pessoa <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="usuario"
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(valor) => field.onChange(Number(valor))}
                  >
                    <SelectTrigger id="p-usuario" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios.map((usuario) => (
                        <SelectItem key={usuario.id} value={String(usuario.id)}>
                          {nomeExibicao(usuario)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.usuario && (
                <p className="text-xs text-destructive">{errors.usuario.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-recurso">
                Recurso <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="recurso"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="p-recurso" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURSOS.map((recurso) => (
                        <SelectItem key={recurso.valor} value={recurso.valor}>
                          {recurso.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.recurso && (
                <p className="text-xs text-destructive">{errors.recurso.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-acao">
                Ação <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="acao"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="p-acao" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ACOES.map((acao) => (
                        <SelectItem key={acao} value={acao}>
                          {ROTULO_ACAO[acao]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.acao && <p className="text-xs text-destructive">{errors.acao.message}</p>}
              <p className="text-xs text-muted-foreground">
                Editar também concede visualização. Lixeira, aprovação e configurações continuam
                seguindo as regras administrativas do sistema.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-escopo">
                Escopo <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="escopo_tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="p-escopo" className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROTULO_ESCOPO) as EscopoPermissao[]).map((escopo) => (
                        <SelectItem key={escopo} value={escopo}>
                          {ROTULO_ESCOPO[escopo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Só aparece o campo relevante pro escopo escolhido -- mesmo
                critério condicional que o backend exige (validate() em
                PermissaoUsuarioSerializer). */}
            {escopoSelecionado === "unidade" && (
              <div className="space-y-1.5">
                <Label htmlFor="p-unidade">
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
                      <SelectTrigger id="p-unidade" className="w-full">
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
            )}

            {escopoSelecionado === "setor" && (
              <div className="space-y-1.5">
                <Label htmlFor="p-setor">
                  Setor <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="setor"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={(valor) => field.onChange(Number(valor))}
                    >
                      <SelectTrigger id="p-setor" className="w-full">
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
                {errors.setor && (
                  <p className="text-xs text-destructive">{errors.setor.message}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-data-inicio">
                  Início <span className="text-destructive">*</span>
                </Label>
                <Input id="p-data-inicio" type="date" {...register("data_inicio")} />
                {errors.data_inicio && (
                  <p className="text-xs text-destructive">{errors.data_inicio.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-data-fim">Fim</Label>
                <Input id="p-data-fim" type="date" {...register("data_fim")} />
                {errors.data_fim && (
                  <p className="text-xs text-destructive">{errors.data_fim.message}</p>
                )}
              </div>
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">
              Sem data de fim, a permissão fica valendo indefinidamente até ser revogada
              manualmente.
            </p>
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Concedendo..." : "Conceder permissão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
