"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useParametrosAbsenteismo } from "@/hooks/useParametrosGestaoRH";
import { extrairMensagemErro } from "@/lib/erros";
import {
  ROTULO_TIPO_OCORRENCIA,
  TIPOS_OCORRENCIA_COMPUTAVEIS,
  errosDeCampo,
  percentualParaCampo,
  textoVersaoVigente,
} from "@/lib/gestaoRH";
import type {
  TipoOcorrenciaComputavel,
  VersaoParametrosAbsenteismo,
} from "@/types/gestaoRH";

const percentualOpcional = z
  .string()
  .trim()
  .refine((valor) => valor === "" || (Number(valor) >= 0 && Number(valor) <= 100), {
    message: "Entre 0 e 100.",
  });

const schema = z
  .object({
    // Vazio é "Obrigatório", não 0: 0 é um limite válido (todo atraso
    // contaria) e seria salvo sem ninguém perceber.
    limite_atraso_minutos: z.preprocess(
      (valor) => (valor === "" || valor === null || valor === undefined ? undefined : Number(valor)),
      z
        .number({ error: "Obrigatório." })
        .int("Número inteiro de minutos.")
        .min(0, "Não pode ser negativo.")
        .max(240, "No máximo 240 minutos."),
    ),
    meta_percentual: percentualOpcional,
    atencao_a_partir_de: percentualOpcional,
    critica_acima_de: percentualOpcional,
    tipos_computados: z
      .array(z.enum(TIPOS_OCORRENCIA_COMPUTAVEIS as [TipoOcorrenciaComputavel]))
      .min(1, "Escolha ao menos um tipo."),
  })
  .superRefine((valores, ctx) => {
    const atencao = valores.atencao_a_partir_de;
    const critica = valores.critica_acima_de;
    if ((atencao === "") !== (critica === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["faixas"],
        message: "Preencha as duas faixas, ou deixe as duas vazias.",
      });
    } else if (atencao !== "" && Number(critica) <= Number(atencao)) {
      ctx.addIssue({
        code: "custom",
        path: ["faixas"],
        message: "A faixa crítica precisa começar acima da faixa de atenção.",
      });
    }
  });

type ValoresEntrada = z.input<typeof schema>;
type ValoresSaida = z.output<typeof schema>;
type CampoComErro = keyof ValoresEntrada | "faixas";

function valoresDaVersao(versao: VersaoParametrosAbsenteismo): ValoresEntrada {
  return {
    limite_atraso_minutos: versao.limite_atraso_minutos,
    meta_percentual: percentualParaCampo(versao.meta_percentual),
    atencao_a_partir_de: percentualParaCampo(versao.faixas?.atencao_a_partir_de),
    critica_acima_de: percentualParaCampo(versao.faixas?.critica_acima_de),
    tipos_computados: versao.tipos_computados,
  };
}

function MensagemErro({ texto }: { texto?: string }) {
  if (!texto) return null;
  return <p className="text-xs text-destructive">{texto}</p>;
}

export function FormParametrosAbsenteismo() {
  const { vigente, isLoading, mensagemErro, salvar } = useParametrosAbsenteismo();
  const [salvando, setSalvando] = useState(false);
  const [erroFaixas, setErroFaixas] = useState<string>();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    formState: { errors, isDirty },
  } = useForm<ValoresEntrada & { faixas?: string }, unknown, ValoresSaida>({
    resolver: zodResolver(schema),
  });

  // Recarregar a versão vigente (ex.: outro Admin salvou e a tela revalidou)
  // não substitui uma edição em andamento. Depois de salvar, quem reinicia o
  // formulário é o próprio aoSubmeter.
  useEffect(() => {
    if (vigente && !isDirty) reset(valoresDaVersao(vigente));
  }, [vigente, isDirty, reset]);

  const semFaixas = !watch("atencao_a_partir_de") && !watch("critica_acima_de");

  async function aoSubmeter(valores: ValoresSaida) {
    setErroFaixas(undefined);
    setSalvando(true);
    try {
      const resultado = await salvar({
        limite_atraso_minutos: valores.limite_atraso_minutos,
        meta_percentual: valores.meta_percentual || null,
        faixas: valores.atencao_a_partir_de
          ? {
              atencao_a_partir_de: valores.atencao_a_partir_de,
              critica_acima_de: valores.critica_acima_de,
            }
          : null,
        tipos_computados: valores.tipos_computados,
      });
      if (resultado.dados.vigente) reset(valoresDaVersao(resultado.dados.vigente));
      if (resultado.criouVersao) {
        toast.success("Nova versão dos parâmetros salva.");
      } else {
        toast.info("Nenhuma alteração: a versão vigente continua a mesma.");
      }
    } catch (erro) {
      const porCampo = errosDeCampo(erro);
      if (Object.keys(porCampo).length === 0) {
        toast.error(extrairMensagemErro(erro));
        return;
      }
      for (const [campo, mensagem] of Object.entries(porCampo)) {
        if (campo === "faixas") setErroFaixas(mensagem);
        else setError(campo as CampoComErro, { message: mensagem });
      }
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (mensagemErro || !vigente) {
    return (
      <p className="text-sm text-destructive">
        {mensagemErro ?? "Parâmetros de absenteísmo não encontrados."}
      </p>
    );
  }

  const mensagemFaixas = errors.faixas?.message ?? erroFaixas;

  return (
    <section aria-labelledby="titulo-parametros-absenteismo" className="space-y-5">
      <div className="space-y-1">
        <h2 id="titulo-parametros-absenteismo" className="text-base font-semibold text-foreground">
          Parâmetros de absenteísmo
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada alteração cria uma nova versão; a versão anterior continua valendo para os
          períodos já calculados.
        </p>
        <p className="text-xs font-medium text-secondary">{textoVersaoVigente(vigente)}</p>
      </div>

      <form
        onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
        className="space-y-5"
        noValidate
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pa-limite">Limite de atraso e saída antecipada (minutos)</Label>
            <Input id="pa-limite" type="number" min={0} max={240} {...register("limite_atraso_minutos")} />
            <p className="text-xs text-muted-foreground">Só conta o que passar do limite.</p>
            <MensagemErro texto={errors.limite_atraso_minutos?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pa-meta">Meta de absenteísmo (%)</Label>
            <Input id="pa-meta" type="number" min={0} max={100} step="0.01" placeholder="Sem meta" {...register("meta_percentual")} />
            <p className="text-xs text-muted-foreground">Exibida como referência no painel.</p>
            <MensagemErro texto={errors.meta_percentual?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pa-atencao">Faixa de atenção a partir de (%)</Label>
            <Input id="pa-atencao" type="number" min={0} max={100} step="0.01" placeholder="Sem faixa" {...register("atencao_a_partir_de")} />
            <p className="text-xs text-muted-foreground">Aparece só no painel.</p>
            <MensagemErro texto={errors.atencao_a_partir_de?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pa-critica">Faixa crítica acima de (%)</Label>
            <Input id="pa-critica" type="number" min={0} max={100} step="0.01" placeholder="Sem faixa" {...register("critica_acima_de")} />
            <p className="text-xs text-muted-foreground">Só a faixa crítica gera demanda.</p>
            <MensagemErro texto={errors.critica_acima_de?.message} />
          </div>
        </div>

        {mensagemFaixas ? (
          <MensagemErro texto={mensagemFaixas} />
        ) : (
          semFaixas && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Sem faixas cadastradas: nenhum colaborador é classificado e nenhuma demanda de
              absenteísmo é gerada.
            </p>
          )
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">
            Tipos de ocorrência que contam no absenteísmo
          </legend>
          <Controller
            control={control}
            name="tipos_computados"
            render={({ field }) => (
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {TIPOS_OCORRENCIA_COMPUTAVEIS.map((tipo) => {
                  const marcado = field.value?.includes(tipo) ?? false;
                  return (
                    <label key={tipo} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(valor) =>
                          field.onChange(
                            valor === true
                              ? [...(field.value ?? []), tipo]
                              : (field.value ?? []).filter((item) => item !== tipo),
                          )
                        }
                      />
                      {ROTULO_TIPO_OCORRENCIA[tipo]}
                    </label>
                  );
                })}
              </div>
            )}
          />
          <p className="text-xs text-muted-foreground">Férias e banco de horas nunca contam.</p>
          <MensagemErro texto={errors.tipos_computados?.message} />
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={salvando}
            onClick={() => {
              setErroFaixas(undefined);
              reset(valoresDaVersao(vigente));
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar nova versão"}
          </Button>
        </div>
      </form>
    </section>
  );
}
