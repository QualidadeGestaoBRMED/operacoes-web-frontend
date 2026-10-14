"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useParametrosAbsenteismo } from "@/hooks/useParametrosGestaoRH";
import { NIVEL_ADMIN_OPERACOES } from "@/hooks/useAuth";
import { useUsuarios } from "@/hooks/useUsuarios";
import { ErroAoCarregar, MensagemErro } from "./mensagens";
import { extrairMensagemErro } from "@/lib/erros";
import {
  ROTULO_TIPO_OCORRENCIA,
  TIPOS_OCORRENCIA_COMPUTAVEIS,
  errosDeCampo,
  percentualParaCampo,
  textoVersaoVigente,
} from "@/lib/gestaoRH";
import type {
  NovaVersaoParametrosPayload,
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
    janela_tipo: z.enum(["desligada", "mes_anterior_fechado", "ultimos_dias"]),
    janela_dias: z.string().trim(),
    // Id do usuário em texto; SEM_RESPONSAVEL = nenhum.
    responsavel_tmo: z.string(),
    responsavel_campanha: z.string(),
  })
  .superRefine((valores, ctx) => {
    if (valores.janela_tipo === "ultimos_dias") {
      const dias = Number(valores.janela_dias);
      if (valores.janela_dias === "") {
        ctx.addIssue({ code: "custom", path: ["janela_dias"], message: "Informe quantos dias." });
      } else if (!Number.isInteger(dias) || dias < DIAS_DA_JANELA.min || dias > DIAS_DA_JANELA.max) {
        ctx.addIssue({
          code: "custom",
          path: ["janela_dias"],
          message: `Número inteiro de ${DIAS_DA_JANELA.min} a ${DIAS_DA_JANELA.max} dias.`,
        });
      }
    }
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

const CAMPOS_COM_ERRO_NA_TELA = new Set<string>([
  "limite_atraso_minutos",
  "janela_dias",
  "meta_percentual",
  "tipos_computados",
  "responsavel_tmo",
  "responsavel_campanha",
]);

const SEM_RESPONSAVEL = "nenhum";

// Mesmos limites do backend (gestao_rh/serializers.py, DIAS_DA_JANELA).
const DIAS_DA_JANELA = { min: 7, max: 90 };

type TipoJanelaNaTela = ValoresSaida["janela_tipo"];

const OPCOES_JANELA: { valor: TipoJanelaNaTela; rotulo: string }[] = [
  { valor: "desligada", rotulo: "Desligada" },
  { valor: "mes_anterior_fechado", rotulo: "Mês anterior fechado" },
  { valor: "ultimos_dias", rotulo: "Últimos N dias" },
];

const QUANDO_AVALIA: Record<Exclude<TipoJanelaNaTela, "desligada">, string> = {
  mes_anterior_fechado: "Todo dia 1º, à noite, avalia o mês que acabou.",
  ultimos_dias: "Toda segunda-feira, à noite, avalia os N dias até o domingo.",
};

function janelaParaEnvio(
  valores: ValoresSaida,
): NonNullable<NovaVersaoParametrosPayload["janela_avaliacao"]> | null {
  if (valores.janela_tipo === "desligada") return null;
  if (valores.janela_tipo === "ultimos_dias") {
    return { tipo: "ultimos_dias", dias: Number(valores.janela_dias) };
  }
  return { tipo: "mes_anterior_fechado" };
}

// Equipes sem unidade do Atlas: as demandas de absenteísmo delas vão para o
// responsável da categoria, no lugar da coordenação da unidade.
const RESPONSAVEIS: {
  campo: "responsavel_tmo" | "responsavel_campanha";
  rotulo: string;
  id: string;
}[] = [
  { campo: "responsavel_tmo", rotulo: "TMO", id: "pa-resp-tmo" },
  { campo: "responsavel_campanha", rotulo: "Campanha", id: "pa-resp-campanha" },
];

// Tipos sempre na ordem da tela: o react-hook-form compara listas por
// posição, e desmarcar e marcar de novo não pode contar como alteração.
function naOrdemDaTela(tipos: readonly string[]): TipoOcorrenciaComputavel[] {
  return TIPOS_OCORRENCIA_COMPUTAVEIS.filter((tipo) => tipos.includes(tipo));
}

function valoresDaVersao(versao: VersaoParametrosAbsenteismo): ValoresEntrada {
  return {
    // Texto, como o input devolve: com número, voltar ao valor original
    // ainda contaria como alteração.
    limite_atraso_minutos: String(versao.limite_atraso_minutos),
    meta_percentual: percentualParaCampo(versao.meta_percentual),
    atencao_a_partir_de: percentualParaCampo(versao.faixas?.atencao_a_partir_de),
    critica_acima_de: percentualParaCampo(versao.faixas?.critica_acima_de),
    tipos_computados: naOrdemDaTela(versao.tipos_computados),
    janela_tipo: versao.janela_avaliacao?.tipo ?? "desligada",
    janela_dias: versao.janela_avaliacao?.dias ? String(versao.janela_avaliacao.dias) : "",
    responsavel_tmo: versao.responsavel_tmo ? String(versao.responsavel_tmo.id) : SEM_RESPONSAVEL,
    responsavel_campanha: versao.responsavel_campanha
      ? String(versao.responsavel_campanha.id)
      : SEM_RESPONSAVEL,
  };
}

function idDoResponsavel(valor: string): number | null {
  return valor === SEM_RESPONSAVEL ? null : Number(valor);
}

export function FormParametrosAbsenteismo() {
  const { vigente, isLoading, mensagemErro, recarregar, salvar } = useParametrosAbsenteismo();
  const { usuarios, isLoading: carregandoUsuarios, error: erroUsuarios } = useUsuarios();
  // Sem a lista, o campo só mostraria "Sem responsável" e o atual: trocar
  // fica bloqueado até ela carregar.
  const responsaveisBloqueados = carregandoUsuarios || !!erroUsuarios;
  const [salvando, setSalvando] = useState(false);
  const [erroFaixas, setErroFaixas] = useState<string>();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    formState: { errors, isDirty, dirtyFields },
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
  const tipoJanela = watch("janela_tipo");

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
        // Só se mudou, como os responsáveis: ausente, o backend mantém a
        // atual; null desliga a avaliação.
        ...((dirtyFields.janela_tipo || dirtyFields.janela_dias) && {
          janela_avaliacao: janelaParaEnvio(valores),
        }),
        // Só os responsáveis que mudaram: ausente, o backend mantém o atual.
        // Mandar sempre travaria o salvar quando o responsável atual foi
        // desativado (o backend só aceita usuário ativo).
        ...(dirtyFields.responsavel_tmo && { responsavel_tmo: idDoResponsavel(valores.responsavel_tmo) }),
        ...(dirtyFields.responsavel_campanha && {
          responsavel_campanha: idDoResponsavel(valores.responsavel_campanha),
        }),
      });
      if (resultado.dados.vigente) reset(valoresDaVersao(resultado.dados.vigente));
      if (resultado.criouVersao) {
        toast.success("Nova versão dos parâmetros salva.");
      } else {
        toast.info("Nenhuma alteração: a versão vigente continua a mesma.");
      }
    } catch (erro) {
      // Chave sem campo na tela (ex.: non_field_errors) vira toast, para o
      // erro nunca sumir em silêncio.
      const porCampo = errosDeCampo(erro);
      if (Object.keys(porCampo).length === 0) {
        toast.error(extrairMensagemErro(erro));
        return;
      }
      const semCampo: string[] = [];
      for (const [campo, mensagem] of Object.entries(porCampo)) {
        if (campo === "faixas") setErroFaixas(mensagem);
        else if (campo === "janela_avaliacao") setError("janela_tipo", { message: mensagem });
        else if (CAMPOS_COM_ERRO_NA_TELA.has(campo)) {
          setError(campo as CampoComErro, { message: mensagem });
        } else semCampo.push(mensagem);
      }
      if (semCampo.length > 0) toast.error(semCampo.join(" "));
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  // Falha numa revalidação com dado em tela mantém o formulário (e a edição).
  if (!vigente) {
    return (
      <ErroAoCarregar
        mensagem={mensagemErro ?? "Parâmetros de absenteísmo não encontrados."}
        aoTentarNovamente={recarregar}
      />
    );
  }

  const mensagemFaixas = errors.faixas?.message ?? erroFaixas;

  return (
    <section aria-labelledby="titulo-parametros-absenteismo" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="titulo-parametros-absenteismo" className="text-base font-semibold text-foreground">
            Parâmetros de absenteísmo
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada alteração cria uma nova versão; a versão anterior continua valendo para os
            períodos já calculados.
          </p>
        </div>
        <Badge variant="outline">{textoVersaoVigente(vigente)}</Badge>
      </div>

      <form
        onSubmit={(evento) => void handleSubmit(aoSubmeter)(evento)}
        className="space-y-5"
        noValidate
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="pa-limite">Limite de atraso e saída antecipada (minutos)</Label>
            <Input id="pa-limite" type="number" min={0} max={240} aria-invalid={!!errors.limite_atraso_minutos} aria-describedby={errors.limite_atraso_minutos ? "pa-limite-erro" : undefined} {...register("limite_atraso_minutos")} />
            <p className="text-xs text-muted-foreground">Só conta o que passar do limite.</p>
            <MensagemErro id="pa-limite-erro" texto={errors.limite_atraso_minutos?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pa-meta">Limite de absenteísmo (%)</Label>
            <Input id="pa-meta" type="number" min={0} max={100} step="0.01" placeholder="Sem limite" aria-invalid={!!errors.meta_percentual} aria-describedby={errors.meta_percentual ? "pa-meta-erro" : undefined} {...register("meta_percentual")} />
            <p className="text-xs text-muted-foreground">Referência no painel: acima dele, o absenteísmo aparece em vermelho.</p>
            <MensagemErro id="pa-meta-erro" texto={errors.meta_percentual?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pa-atencao">Faixa de atenção a partir de (%)</Label>
            <Input id="pa-atencao" type="number" min={0} max={100} step="0.01" placeholder="Sem faixa" aria-invalid={!!errors.atencao_a_partir_de || !!mensagemFaixas} aria-describedby={[errors.atencao_a_partir_de && "pa-atencao-erro", mensagemFaixas && "pa-faixas-erro"].filter(Boolean).join(" ") || undefined} {...register("atencao_a_partir_de")} />
            <p className="text-xs text-muted-foreground">Aparece só no painel.</p>
            <MensagemErro id="pa-atencao-erro" texto={errors.atencao_a_partir_de?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pa-critica">Faixa crítica acima de (%)</Label>
            <Input id="pa-critica" type="number" min={0} max={100} step="0.01" placeholder="Sem faixa" aria-invalid={!!errors.critica_acima_de || !!mensagemFaixas} aria-describedby={[errors.critica_acima_de && "pa-critica-erro", mensagemFaixas && "pa-faixas-erro"].filter(Boolean).join(" ") || undefined} {...register("critica_acima_de")} />
            <p className="text-xs text-muted-foreground">Só a faixa crítica gera demanda.</p>
            <MensagemErro id="pa-critica-erro" texto={errors.critica_acima_de?.message} />
          </div>
        </div>

        {mensagemFaixas ? (
          <MensagemErro id="pa-faixas-erro" texto={mensagemFaixas} />
        ) : (
          semFaixas && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-secondary" />
              Sem faixas cadastradas: nenhum colaborador é classificado e nenhuma demanda de
              absenteísmo é gerada.
            </p>
          )
        )}

        {/* A linha fica fora do fieldset: nele, o navegador desenha a legenda
            em cima da borda. */}
        <div className="border-t border-border pt-5">
          <fieldset
            className="space-y-2"
            aria-invalid={!!errors.tipos_computados}
            aria-describedby={errors.tipos_computados ? "pa-tipos-erro" : undefined}
          >
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
                              naOrdemDaTela(
                                valor === true
                                  ? [...(field.value ?? []), tipo]
                                  : (field.value ?? []).filter((item) => item !== tipo),
                              ),
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
            <p className="text-xs text-muted-foreground">
              Férias, afastamento e banco de horas nunca contam.
            </p>
            <MensagemErro id="pa-tipos-erro" texto={errors.tipos_computados?.message} />
          </fieldset>
        </div>

        <div className="border-t border-border pt-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Avaliação automática</legend>
            <p className="text-xs text-muted-foreground">
              Período avaliado para gerar alerta e demanda de quem fechou na faixa crítica. A
              avaliação roda depois da importação do robô; se ela atrasar, o período é avaliado
              no primeiro dia em que estiver completo. Cada período é avaliado uma vez.
            </p>
            <div className="grid gap-5 pt-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="pa-janela">Janela de avaliação</Label>
                <Controller
                  control={control}
                  name="janela_tipo"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      // Mesmo cuidado dos responsáveis: o Radix chama com ""
                      // ao montar dentro de um <form>.
                      onValueChange={(valor) => valor && field.onChange(valor)}
                    >
                      <SelectTrigger
                        id="pa-janela"
                        aria-invalid={!!errors.janela_tipo}
                        aria-describedby={errors.janela_tipo ? "pa-janela-erro" : undefined}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPCOES_JANELA.map(({ valor, rotulo }) => (
                          <SelectItem key={valor} value={valor}>
                            {rotulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {tipoJanela && tipoJanela !== "desligada" && (
                  <p className="text-xs text-muted-foreground">{QUANDO_AVALIA[tipoJanela]}</p>
                )}
                <MensagemErro id="pa-janela-erro" texto={errors.janela_tipo?.message} />
              </div>
              {tipoJanela === "ultimos_dias" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pa-janela-dias">Quantos dias (N)</Label>
                  <Input id="pa-janela-dias" type="number" min={DIAS_DA_JANELA.min} max={DIAS_DA_JANELA.max} aria-invalid={!!errors.janela_dias} aria-describedby={errors.janela_dias ? "pa-janela-dias-erro" : undefined} {...register("janela_dias")} />
                  <p className="text-xs text-muted-foreground">
                    De {DIAS_DA_JANELA.min} a {DIAS_DA_JANELA.max} dias.
                  </p>
                  <MensagemErro id="pa-janela-dias-erro" texto={errors.janela_dias?.message} />
                </div>
              )}
            </div>
            {tipoJanela === "desligada" && (
              <p className="flex items-start gap-2 pt-1 text-sm text-muted-foreground">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-secondary" />
                Avaliação automática desligada: nenhum alerta nem demanda de absenteísmo é
                gerado. O painel continua calculando qualquer período.
              </p>
            )}
          </fieldset>
        </div>

        <div className="border-t border-border pt-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Responsáveis pelas equipes sem unidade
            </legend>
            <p className="text-xs text-muted-foreground">
              TMO e Campanha não têm coordenação de unidade: as demandas de absenteísmo dessas
              equipes vão para quem estiver aqui. Só Admins, porque só eles veem esses
              colaboradores no módulo.
            </p>
            <div className="grid gap-5 pt-2 sm:grid-cols-2 xl:grid-cols-4">
              {RESPONSAVEIS.map(({ campo, rotulo, id }) => {
                const erro = errors[campo]?.message;
                return (
                  <div key={campo} className="space-y-1.5">
                    <Label htmlFor={id}>{rotulo}</Label>
                    <Controller
                      control={control}
                      name={campo}
                      render={({ field }) => {
                        const atual = vigente[campo];
                        // Só Admin ativo: o backend recusa os outros (STC-594).
                        // O responsável atual entra na lista mesmo se não vier
                        // mais nela (ex.: deixou de ser Admin), para o campo
                        // não aparecer vazio.
                        const opcoes = usuarios.filter(
                          (usuario) =>
                            usuario.ativo &&
                            usuario.perfil !== null &&
                            usuario.perfil.nivel <= NIVEL_ADMIN_OPERACOES,
                        );
                        const faltaAtual = atual && !opcoes.some((u) => u.id === atual.id);
                        return (
                          <Select
                            value={field.value}
                            disabled={responsaveisBloqueados}
                            // O Radix chama com "" ao montar dentro de um
                            // <form>; sem ignorar, o formulário já abriria
                            // como alterado.
                            onValueChange={(valor) => valor && field.onChange(valor)}
                          >
                            <SelectTrigger
                              id={id}
                              aria-invalid={!!erro}
                              aria-describedby={erro ? `${id}-erro` : undefined}
                              className="w-full"
                            >
                              <SelectValue placeholder="Sem responsável" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SEM_RESPONSAVEL}>Sem responsável</SelectItem>
                              {faltaAtual && (
                                <SelectItem value={String(atual.id)}>{atual.nome}</SelectItem>
                              )}
                              {opcoes.map((usuario) => (
                                <SelectItem key={usuario.id} value={String(usuario.id)}>
                                  {[usuario.first_name, usuario.last_name].join(" ").trim() ||
                                    usuario.username}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      }}
                    />
                    <MensagemErro id={`${id}-erro`} texto={erro} />
                  </div>
                );
              })}
            </div>
            {erroUsuarios && (
              <p role="alert" className="text-xs text-destructive">
                Não foi possível carregar os usuários: os responsáveis não podem ser trocados agora.
                Recarregue a página para tentar de novo.
              </p>
            )}
          </fieldset>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={salvando || !isDirty}
            onClick={() => {
              setErroFaixas(undefined);
              reset(valoresDaVersao(vigente));
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando || !isDirty}>
            {salvando ? "Salvando..." : "Salvar nova versão"}
          </Button>
        </div>
      </form>
    </section>
  );
}
