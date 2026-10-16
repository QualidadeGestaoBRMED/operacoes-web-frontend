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
import {
  encontrarRecursoPorChave,
  useModulos,
  useRecursosPermissao,
} from "@/hooks/useModulos";
import { useAuth } from "@/hooks/useAuth";
import { useCriarPermissao } from "@/hooks/usePermissoes";
import { useSetores } from "@/hooks/useSetores";
import { useUnidades } from "@/hooks/useUnidades";
import { useUsuarios } from "@/hooks/useUsuarios";
import { extrairMensagemErro } from "@/lib/erros";
import { ROTULO_REDE } from "@/lib/redes";
import { nomeExibicao } from "@/lib/utils";
import type { AcaoPermissao, EscopoPermissao, Rede } from "@/types";
import { usuariosGerenciaveis } from "./GerenciarUsuarios";

type AcaoKanban = Extract<AcaoPermissao, "visualizar" | "editar">;

// STC-422: este formulário só concede visualizar/editar (nunca os outros
// valores de PermissaoUsuario.Acao) -- "editar" já implica leitura no
// backend, então não faz sentido criar também um segundo registro
// "visualizar". Continua fixo aqui (não vem do catálogo): é um teto do que
// ESTE formulário sabe conceder, não do que o recurso suporta -- a lista
// realmente oferecida pro usuário é a interseção com
// recurso.acoes_suportadas (ver acoesDisponiveis abaixo).
const ACOES_KANBAN: AcaoKanban[] = ["visualizar", "editar"];

const ROTULO_ACAO: Record<AcaoPermissao, string> = {
  visualizar: "Visualizar",
  criar: "Criar",
  editar: "Editar",
  aprovar: "Aprovar",
  excluir: "Excluir",
  restaurar: "Restaurar",
  configurar: "Configurar",
};

const COBERTURA_DO_GLOBAL: Record<Rede, string> = {
  padrao: "Cobre as unidades da rede própria.",
  opex: "Cobre as unidades de Operações Especiais.",
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
    // Escopo global (STC-745): a rede que ele cobre ("ambas" = as duas, só
    // para quem administra as duas).
    rede: z.enum(["padrao", "opex", "ambas"]).optional(),
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

// Exportado só pra PermissoesAdmin.tsx conseguir tipar o que monta pra
// "Renovar" -- mesmo formato que valoresIniciais aceita abaixo.
export type ValoresIniciaisPermissao = Partial<FormValuesEntrada>;

const valoresPadrao: Partial<FormValuesEntrada> = {
  acao: "visualizar",
  escopo_tipo: "unidade",
};

export function FormNovaPermissao({
  open,
  onOpenChange,
  valoresIniciais,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Achado no dogfooding (pedido da Solicitante): "Reativar" uma permissão
  // com data de fim não pode só religar o registro antigo -- as datas já
  // passaram, religar do jeito que está voltaria "Expirada" na hora. Em vez
  // de reescrever o registro (perderia o rastro de que ela tinha expirado/
  // sido revogada antes), PermissoesAdmin.tsx abre este mesmo formulário
  // pré-preenchido com tudo que definia o acesso -- só Início/Fim ficam em
  // branco, já que as antigas não servem mais pra um período novo.
  valoresIniciais?: Partial<FormValuesEntrada>;
}) {
  const { user: ator, redesAdministradas, administraRedePadrao, administraAsDuasRedes } =
    useAuth();
  const { usuarios: todosOsUsuarios } = useUsuarios();
  const { unidades: todasAsUnidades, isLoading: carregandoUnidades } = useUnidades();
  // Cada Admin concede só a quem gerencia, e só nas unidades das redes dele
  // (STC-745). Quem ele gerencia depende da rede da unidade de cada pessoa:
  // a lista só sai com as unidades carregadas.
  const usuarios = carregandoUnidades
    ? []
    : usuariosGerenciaveis(todosOsUsuarios, ator, todasAsUnidades);
  const unidades = todasAsUnidades.filter((unidade) => redesAdministradas.includes(unidade.rede));
  const { setores } = useSetores();
  const { recursos } = useRecursosPermissao();
  // catalogoCarregando/catalogoComErro: mesma chave SWR de
  // useRecursosPermissao() por baixo -- ver achado de code review abaixo,
  // sobre por que essa distinção importa (recursos=[] durante o
  // carregamento, ou por causa de um erro de rede, vs. recurso de fato
  // removido do catálogo são estados diferentes).
  const { modulos, isLoading: catalogoCarregando, error: catalogoComErro } = useModulos();
  // Achado em code review: só `isLoading` era considerado -- quando o fetch
  // de módulos falhava (timeout, 5xx), o SWR volta `isLoading: false` com
  // `data` undefined, então `recursos`/`modulos` ficavam `[]`
  // *permanentemente* (até o retry automático), o mesmo estado que o código
  // tratava como "carregado com sucesso e vazio". Tratado aqui como o mesmo
  // "não sei ainda" de catalogoCarregando, não como "recurso confirmado
  // ausente".
  const catalogoIndisponivel = catalogoCarregando || !!catalogoComErro;
  const { criar, isLoading } = useCriarPermissao();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValuesEntrada, unknown, FormValuesSaida>({
    resolver: zodResolver(schema),
    defaultValues: valoresPadrao,
  });

  useEffect(() => {
    // valoresIniciais deliberadamente fora das deps: o dialog sempre fecha
    // entre um uso e outro, então cada abertura já dispara este efeito de
    // novo com o valor mais recente da prop -- entrar nas deps só geraria
    // reset em todo re-render enquanto aberto (valoresIniciais é um objeto
    // novo a cada chamada de PermissoesAdmin).
    if (open) reset({ ...valoresPadrao, ...valoresIniciais });
    else reset(valoresPadrao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  const escopoSelecionado = watch("escopo_tipo");
  const recursoSelecionado = watch("recurso");
  const acaoSelecionada = watch("acao");
  const recursoAtual = encontrarRecursoPorChave(recursos, recursoSelecionado);
  // Teto ACOES_KANBAN ∩ o que o recurso escolhido realmente suporta -- sem
  // recurso escolhido ainda, mostra o teto inteiro (mesmo comportamento de
  // antes, quando a lista era só um array fixo).
  // Achado em code review: acoes_suportadas é obrigatório só pro
  // TypeScript -- listarModulos() faz cast direto da resposta do axios, sem
  // validação em runtime. Um recurso vindo de uma resposta com contrato
  // quebrado (backend antigo, cache de cliente durante rollout) sem esse
  // campo derrubaria a página inteira com TypeError; `?? []` é a mesma
  // defesa já aplicada a recursos_permissao em useRecursosPermissao().
  const acoesDisponiveis = recursoAtual
    ? ACOES_KANBAN.filter((acao) =>
        (recursoAtual.acoes_suportadas ?? []).includes(acao),
      )
    : ACOES_KANBAN;
  // Achado no code review: um recurso real (não hipotético -- é exatamente
  // o "recurso novo cadastrado no backend" que a issue promete suportar sem
  // PR de frontend) pode não ter nenhuma interseção com ACOES_KANBAN (ex.:
  // um recurso que só suporta "configurar"). Sem isto, o Select de Ação
  // ficava vazio mas o valor por baixo (watch("acao")) continuava com o
  // padrão "visualizar" -- silenciosamente inválido pro recurso escolhido,
  // sem bloquear o submit nem avisar quem está concedendo.
  const acaoIndisponivel = !!recursoAtual && acoesDisponiveis.length === 0;
  // Achado em code review: "Renovar" pré-preenche recurso/ação direto de
  // valoresIniciais (reset() abaixo), possivelmente antes do catálogo
  // (useRecursosPermissao) terminar de carregar -- se recursos chegasse
  // depois sem entrar nas deps do efeito abaixo, uma ação incompatível já
  // pré-preenchida nunca era revalidada, e ia pro submit sem aviso.
  // recursoOrfao: a chave pré-preenchida pode não existir (mais) no
  // catálogo carregado (recurso removido depois da permissão original) --
  // sem isto, o Select ficava em branco (nem "Selecionar...", nem o valor
  // real), como se nada estivesse escolhido, quando na verdade o campo
  // ainda guarda essa chave por baixo.
  //
  // Achado numa 3ª rodada de code review: recursos=[] durante o
  // carregamento do catálogo é visualmente idêntico a "recurso realmente
  // não existe mais" -- sem checar catalogoCarregando, um recurso válido
  // (ex. "gestao-demandas.kanban") aparecia como órfão por uma fração de
  // segundo em todo "Renovar", já que useRecursosPermissao()/useModulos()
  // ainda não tinham respondido quando o formulário abre pré-preenchido.
  const recursoOrfao =
    recursoSelecionado && !recursoAtual && !catalogoIndisponivel
      ? recursoSelecionado
      : null;

  useEffect(() => {
    // Achado ao tornar Ação dependente do catálogo: trocar de recurso (ou o
    // catálogo terminar de carregar depois de um "Renovar" já ter
    // pré-preenchido os campos) pode deixar a ação já escolhida fora da
    // lista nova (ex.: veio de um recurso que suporta "editar" pra um que
    // só suporta "visualizar") -- sem isto, o valor ficava só visualmente
    // escondido, mas ainda selecionado por baixo, pronto pra ir no submit
    // inválido.
    // acoesDisponiveis.length > 0: quando fica vazio (recurso sem nenhuma
    // ação em comum com ACOES_KANBAN), não tem valor válido pra setValue --
    // esse caso é bloqueado no submit e avisado na tela (acaoIndisponivel
    // abaixo), não silenciosamente ignorado.
    if (
      acaoSelecionada &&
      acoesDisponiveis.length > 0 &&
      !acoesDisponiveis.includes(acaoSelecionada)
    ) {
      setValue("acao", acoesDisponiveis[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recursoSelecionado, recursos]);

  async function aoSubmeter(valores: FormValuesSaida) {
    // Achado numa 3ª rodada de code review: com o catálogo ainda carregando,
    // tanto encontrarRecursoPorChave(recursos, ...) quanto o fallback por
    // Modulo.codigo (modulos.find abaixo) falhavam juntos -- os dois vêm da
    // mesma chamada assíncrona (useModulos()) -- resultando no mesmo
    // `modulo: null` que o achado anterior já tinha corrigido pro caso de
    // recurso de fato removido. O botão já fica desabilitado enquanto isso
    // (ver disabled no submit abaixo); esta é a segunda camada, caso o form
    // seja submetido de outro jeito (ex. Enter) antes do React re-renderizar
    // o botão.
    if (catalogoIndisponivel) {
      toast.error(
        catalogoComErro
          ? "Não foi possível carregar o catálogo de recursos -- tente novamente."
          : "Catálogo de recursos ainda carregando -- tente de novo em instantes.",
      );
      return;
    }
    // Achado no code review: um recurso sem nenhuma ação em comum com
    // ACOES_KANBAN não tinha bloqueio nenhum -- o Select de Ação ficava
    // vazio, mas o valor padrão ("visualizar") sobrevivia por baixo e ia
    // pro submit como se o recurso suportasse essa ação. Segunda camada
    // (o botão já fica desabilitado, ver disabled abaixo), mesmo motivo do
    // catalogoCarregando acima.
    if (acaoIndisponivel) {
      toast.error(
        "Este recurso não suporta nenhuma ação que este formulário pode conceder.",
      );
      return;
    }
    try {
      // O módulo dono do recurso normalmente já vem junto ao achatar o
      // catálogo (useRecursosPermissao -- ver moduloId em useModulos.ts).
      // Achado no code review: "Renovar" pode reenviar uma chave de recurso
      // que saiu do catálogo (recursoOrfao acima) sem o usuário tocar no
      // campo -- nesse caso encontrarRecursoPorChave não acha nada, e sem
      // fallback o módulo se perdia (`modulo: null`) mesmo quando o módulo
      // em si continua existindo, só aquele recurso específico é que não
      // está mais listado nele. Fallback pelo prefixo de "recurso" antes do
      // "." contra Modulo.codigo -- mesmo mecanismo que existia antes desta
      // issue trocar a fonte de dados, mantido só como rede de segurança
      // pra esse caminho.
      const moduloId =
        encontrarRecursoPorChave(recursos, valores.recurso)?.moduloId ??
        modulos.find((modulo) => modulo.codigo === valores.recurso.split(".")[0])
          ?.id ??
        null;

      await criar({
        usuario: valores.usuario,
        modulo: moduloId,
        recurso: valores.recurso,
        acao: valores.acao,
        escopo_tipo: valores.escopo_tipo,
        unidade: valores.escopo_tipo === "unidade" ? valores.unidade : null,
        setor: valores.escopo_tipo === "setor" ? valores.setor : null,
        ...(valores.escopo_tipo === "global" &&
          administraAsDuasRedes && {
            rede: valores.rede === "padrao" || valores.rede === "opex" ? valores.rede : null,
          }),
        data_inicio: valores.data_inicio,
        data_fim: valores.data_fim || null,
      });
      toast.success(valoresIniciais ? "Permissão renovada." : "Permissão concedida.");
      onOpenChange(false);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-[min(32rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{valoresIniciais ? "Renovar permissão" : "Conceder permissão"}</DialogTitle>
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
                      {/* Renovar pode pré-preencher uma chave que saiu do
                          catálogo depois -- mostra ela mesmo assim (em vez
                          de o Select ficar em branco, escondendo que já
                          existe um valor selecionado por baixo). */}
                      {recursoOrfao && (
                        <SelectItem value={recursoOrfao} disabled>
                          {recursoOrfao} (não está mais no catálogo)
                        </SelectItem>
                      )}
                      {recursos.map((recurso) => (
                        <SelectItem key={recurso.chave} value={recurso.chave}>
                          {recurso.moduloNome} -- {recurso.rotulo}
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
                      {acoesDisponiveis.map((acao) => (
                        <SelectItem key={acao} value={acao}>
                          {ROTULO_ACAO[acao]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.acao && <p className="text-xs text-destructive">{errors.acao.message}</p>}
              {acaoIndisponivel ? (
                <p className="text-xs text-destructive">
                  Este recurso não suporta nenhuma ação que este formulário pode conceder.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Editar também concede visualização. Lixeira, aprovação e configurações continuam
                  seguindo as regras administrativas do sistema.
                </p>
              )}
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
                      {(Object.keys(ROTULO_ESCOPO) as EscopoPermissao[])
                        // Setor não tem rede: é da rede padrão (STC-745).
                        .filter((escopo) => escopo !== "setor" || administraRedePadrao)
                        .map((escopo) => (
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

            {/* Global cobre a rede de quem concede (STC-745): quem
                administra as duas escolhe; os demais só têm a sua. */}
            {escopoSelecionado === "global" &&
              (administraAsDuasRedes ? (
                <div className="space-y-1.5">
                  <Label htmlFor="p-rede">Rede</Label>
                  <Controller
                    control={control}
                    name="rede"
                    render={({ field }) => (
                      <Select value={field.value ?? "ambas"} onValueChange={field.onChange}>
                        <SelectTrigger id="p-rede" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ambas">As duas redes</SelectItem>
                          <SelectItem value="padrao">{ROTULO_REDE.padrao}</SelectItem>
                          <SelectItem value="opex">{ROTULO_REDE.opex}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {COBERTURA_DO_GLOBAL[redesAdministradas[0]] ?? "Cobre as unidades da sua rede."}
                </p>
              ))}

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
            {/* catalogoIndisponivel: achado em code review -- sem isso, dava
                pra submeter enquanto recursos/modulos ainda não tinham
                resolvido (ou tinham falhado em carregar), resultando em
                modulo: null mesmo pra um recurso válido. acaoIndisponivel:
                achado em code review -- sem isso, dava pra submeter um
                recurso sem nenhuma ação em comum com ACOES_KANBAN, mantendo
                em silêncio o valor padrão ("visualizar") mesmo o Select
                mostrando vazio. */}
            <Button
              type="submit"
              disabled={isLoading || catalogoIndisponivel || acaoIndisponivel}
            >
              {isLoading
                ? valoresIniciais
                  ? "Renovando..."
                  : "Concedendo..."
                : valoresIniciais
                  ? "Renovar permissão"
                  : "Conceder permissão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
