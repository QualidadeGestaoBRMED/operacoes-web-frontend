"use client";

import { useMemo, useState } from "react";
import { Info, Search } from "lucide-react";
import { toast } from "sonner";
import { CabecalhoOrdenavel } from "@/components/CabecalhoOrdenavel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useEquipesVR } from "@/hooks/useParametrosGestaoRH";
import { useUnidades } from "@/hooks/useUnidades";
import { extrairMensagemErro } from "@/lib/erros";
import { CATEGORIAS_EQUIPE, errosDeCampo } from "@/lib/gestaoRH";
import { ordenarPor, proximaOrdenacao, type Ordenacao } from "@/lib/ordenacao";
import { cn } from "@/lib/utils";
import type { CategoriaEquipeVR, EquipeVR, ReclassificarEquipePayload } from "@/types/gestaoRH";
import { ErroAoCarregar, MensagemErro } from "./mensagens";

type CampoEquipes = "equipe" | "colaboradores" | "categoria" | "unidade" | "turno";

const COLUNAS_EQUIPES: { campo: CampoEquipes; rotulo: string; className: string }[] = [
  { campo: "equipe", rotulo: "Equipe", className: "sticky left-0 z-20 bg-muted" },
  { campo: "colaboradores", rotulo: "Colaboradores", className: "w-36 text-right" },
  { campo: "categoria", rotulo: "Categoria", className: "w-56" },
  { campo: "unidade", rotulo: "Unidade do Atlas", className: "w-64" },
  { campo: "turno", rotulo: "Turno variável", className: "w-36" },
];

// Turno variável: as que têm primeiro.
const CHAVES_DE_ORDENACAO = {
  equipe: (equipe: EquipeVR) => equipe.nome,
  colaboradores: (equipe: EquipeVR) => equipe.colaboradores_ativos,
  categoria: (equipe: EquipeVR) => equipe.categoria_rotulo,
  unidade: (equipe: EquipeVR) => equipe.unidade?.nome ?? null,
  turno: (equipe: EquipeVR) => (equipe.turno_variavel ? 0 : 1),
};

const SEM_CATEGORIA = "sem_categoria";
const TODAS = "todas";
// Operações Especiais aceita ficar sem unidade enquanto a ligação não é definida.
const SEM_UNIDADE_OPEX = "sem_unidade";

// Filtros da lista, com "Sem categoria" logo depois de "Todas" (é o que falta fazer).
const FILTROS: { valor: CategoriaEquipeVR | typeof TODAS; rotulo: string }[] = [
  { valor: TODAS, rotulo: "Todas" },
  { valor: SEM_CATEGORIA, rotulo: "Sem categoria" },
  ...CATEGORIAS_EQUIPE,
];

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Aba Equipes dos Parâmetros de Gestão RH (só Admin): a categoria de cada
 * equipe do VR decide se os colaboradores dela entram no indicador de
 * absenteísmo. Unidade leva uma unidade da rede própria (obrigatória);
 * Operações Especiais, uma unidade da rede OPEX (opcional) e fica fora dos
 * painéis da rede própria. Salva ao escolher, como a tabela de usuários da
 * Administração. Trocar para Unidade só salva depois de escolher a unidade
 * (a API exige as duas).
 * Tirar ou trocar a unidade de uma equipe com colaboradores pede
 * confirmação: muda a unidade de todos eles e leva as demandas abertas para
 * a coordenação nova. O turno variável (absenteísmo pela carga horária do
 * dia, não pela escala) também salva ao marcar.
 */

// Campo da linha que a gravação recusada marca como inválido.
type CampoDaEquipe = "classificacao" | "turno_variavel";

interface ErroDaEquipe {
  mensagem: string;
  campo: CampoDaEquipe;
}

interface Mudanca {
  equipe: EquipeVR;
  categoria: CategoriaEquipeVR;
  unidade: number | null;
}
export function AbaEquipes() {
  const { equipes, isLoading, mensagemErro, recarregar, reclassificar } = useEquipesVR();
  const redePropria = useUnidades("padrao");
  const redeOpex = useUnidades("opex");
  const carregandoUnidades = redePropria.isLoading || redeOpex.isLoading;
  const erroUnidades = redePropria.error ?? redeOpex.error;
  const [busca, setBusca] = useState("");
  // Equipes que o Admin passou para Unidade e ainda esperam a escolha da unidade.
  const [esperandoUnidade, setEsperandoUnidade] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState<number | null>(null);
  const [erros, setErros] = useState<Record<number, ErroDaEquipe>>({});
  const [aConfirmar, setAConfirmar] = useState<Mudanca | null>(null);
  const [turnoAConfirmar, setTurnoAConfirmar] = useState<EquipeVR | null>(null);
  const [filtro, setFiltro] = useState<CategoriaEquipeVR | typeof TODAS>(TODAS);

  const ativasDaRedePropria = useMemo(
    () => redePropria.unidades.filter((unidade) => unidade.ativa),
    [redePropria.unidades],
  );
  const ativasDaRedeOpex = useMemo(
    () => redeOpex.unidades.filter((unidade) => unidade.ativa),
    [redeOpex.unidades],
  );
  // Sem coluna escolhida, vale a ordem da API.
  const [ordenacao, setOrdenacao] = useState<Ordenacao<CampoEquipes> | null>(null);
  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    const filtradas = (equipes ?? []).filter(
      (equipe) =>
        (filtro === TODAS || equipe.categoria === filtro) && (!termo || normalizar(equipe.nome).includes(termo)),
    );
    return ordenarPor(filtradas, ordenacao, CHAVES_DE_ORDENACAO);
  }, [equipes, busca, filtro, ordenacao]);
  const porCategoria = useMemo(() => {
    const contagem: Record<string, number> = { [TODAS]: equipes?.length ?? 0 };
    for (const equipe of equipes ?? []) contagem[equipe.categoria] = (contagem[equipe.categoria] ?? 0) + 1;
    return contagem;
  }, [equipes]);
  // Só as unidades da rede da categoria. A unidade atual entra na lista
  // mesmo desativada: sem ela, o campo apareceria vazio numa equipe já
  // classificada.
  function opcoesDeUnidade(equipe: EquipeVR, categoria: CategoriaEquipeVR) {
    const ativas = categoria === "operacoes_especiais" ? ativasDaRedeOpex : ativasDaRedePropria;
    const atual = categoria === equipe.categoria ? equipe.unidade : null;
    if (!atual || ativas.some((unidade) => unidade.id === atual.id)) return ativas;
    return [...ativas, atual];
  }
  const semCategoria = (equipes ?? []).filter((equipe) => equipe.categoria === SEM_CATEGORIA).length;

  function marcarEsperando(id: number, esperando: boolean) {
    setEsperandoUnidade((atual) => {
      const novo = new Set(atual);
      if (esperando) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  // Salva a mudança da equipe; o erro da API fica na linha dela.
  async function enviar(
    equipe: EquipeVR,
    payload: ReclassificarEquipePayload,
    campo: CampoDaEquipe,
    sucesso: (atualizada: EquipeVR) => string,
  ) {
    setSalvando(equipe.id);
    setErros((atual) => {
      const semEsta = { ...atual };
      delete semEsta[equipe.id];
      return semEsta;
    });
    try {
      const atualizada = await reclassificar(equipe.id, payload);
      toast.success(sucesso(atualizada));
      return true;
    } catch (erro) {
      const porCampo = errosDeCampo(erro);
      const mensagem = Object.values(porCampo).join(" ") || extrairMensagemErro(erro);
      setErros((atual) => ({ ...atual, [equipe.id]: { mensagem, campo } }));
      return false;
    } finally {
      setSalvando(null);
    }
  }

  async function salvar(equipe: EquipeVR, categoria: CategoriaEquipeVR, unidade: number | null) {
    const salvou = await enviar(equipe, { categoria, unidade }, "classificacao", (atualizada) =>
      atualizada.unidade
        ? `${atualizada.nome}: ${atualizada.categoria_rotulo} · ${atualizada.unidade.nome}.`
        : `${atualizada.nome}: ${atualizada.categoria_rotulo}.`,
    );
    if (salvou) marcarEsperando(equipe.id, false);
  }

  function salvarTurnoVariavel(equipe: EquipeVR, turnoVariavel: boolean) {
    void enviar(equipe, { turno_variavel: turnoVariavel }, "turno_variavel", (atualizada) =>
      atualizada.turno_variavel
        ? `${atualizada.nome}: turno variável ligado.`
        : `${atualizada.nome}: turno variável desligado.`,
    );
  }

  // Ligar recalcula os períodos já importados e pode encerrar alertas na
  // próxima importação: pede confirmação. Desligar salva direto.
  function mudarTurnoVariavel(equipe: EquipeVR, turnoVariavel: boolean) {
    if (turnoVariavel) setTurnoAConfirmar(equipe);
    else salvarTurnoVariavel(equipe, false);
  }

  // Mudança que tira ou troca a unidade de quem já está na equipe passa
  // pela confirmação; as outras salvam direto.
  function mudar(mudanca: Mudanca) {
    const { equipe, unidade } = mudanca;
    const mexeEmQuemEstaNaEquipe =
      equipe.unidade !== null && equipe.colaboradores_ativos > 0 && unidade !== equipe.unidade.id;
    if (mexeEmQuemEstaNaEquipe) setAConfirmar(mudanca);
    else void salvar(equipe, mudanca.categoria, unidade);
  }

  // Cada categoria só aceita unidade da sua rede: ao trocar de categoria, a
  // unidade atual (da outra rede) não serve. Unidade espera a escolha;
  // Operações Especiais salva sem unidade, e a unidade OPEX vem depois.
  function aoMudarCategoria(equipe: EquipeVR, valor: string) {
    const categoria = valor as CategoriaEquipeVR;
    if (categoria === equipe.categoria) {
      marcarEsperando(equipe.id, false);
      return;
    }
    if (categoria === "unidade") {
      marcarEsperando(equipe.id, true);
      return;
    }
    marcarEsperando(equipe.id, false);
    mudar({ equipe, categoria, unidade: null });
  }

  function descricaoDaConfirmacao({ equipe, categoria, unidade }: Mudanca) {
    const pessoas =
      equipe.colaboradores_ativos === 1 ? "O colaborador" : `Os ${equipe.colaboradores_ativos} colaboradores`;
    const de = equipe.unidade?.nome;
    const para = [...ativasDaRedePropria, ...ativasDaRedeOpex].find((opcao) => opcao.id === unidade)?.nome;
    if (para) {
      return (
        <>
          {pessoas} de <strong>{equipe.nome}</strong> passam de {de} para <strong>{para}</strong>, e as
          demandas abertas deles vão para a coordenação de {para}.
        </>
      );
    }
    const rotulo = CATEGORIAS_EQUIPE.find((opcao) => opcao.valor === categoria)?.rotulo;
    return (
      <>
        {pessoas} de <strong>{equipe.nome}</strong> deixam a unidade {de} e passam para <strong>{rotulo}</strong>,
        sem unidade do Atlas. As demandas abertas deles ficam onde estão.
      </>
    );
  }

  if (isLoading) return <Skeleton className="h-72 w-full" />;
  if (!equipes) {
    return (
      <ErroAoCarregar
        mensagem={mensagemErro ?? "Equipes do VR não encontradas."}
        aoTentarNovamente={recarregar}
      />
    );
  }

  return (
    <section aria-labelledby="titulo-equipes-vr" className="space-y-5 sm:flex sm:min-h-0 sm:flex-1 sm:flex-col">
      <div>
        <h2 id="titulo-equipes-vr" className="text-base font-semibold text-foreground">
          Equipes do VR
        </h2>
        <p className="text-sm text-muted-foreground">
          A categoria define se os colaboradores da equipe entram no indicador de absenteísmo.
          Equipes da categoria Unidade levam uma unidade da rede própria. As de Operações
          Especiais podem ser ligadas a uma unidade de Operações Especiais e não entram nos
          painéis da rede própria: ficam para o ambiente de Operações Especiais.
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Turno variável:</strong> para equipes que
          trabalham fora da escala dentro da carga do dia (ex.: técnico de raio X e motorista de
          campanha). O absenteísmo do dia passa a ser pela carga horária cumprida, sem atraso nem
          saída contra a escala; o que faltar da carga aparece como jornada incompleta. Vale também
          para os períodos já importados.
        </p>
      </div>

      {semCategoria > 0 && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-secondary" />
          {semCategoria === 1
            ? "1 equipe sem categoria: os colaboradores dela ficam fora do indicador até ser classificada."
            : `${semCategoria} equipes sem categoria: os colaboradores delas ficam fora do indicador até serem classificadas.`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar equipe"
            aria-label="Buscar equipe"
            className="pl-8"
          />
        </div>
        <div role="group" aria-label="Filtrar por categoria" className="flex flex-wrap gap-1.5">
          {FILTROS.map(({ valor, rotulo }) => (
            <Button
              key={valor}
              type="button"
              size="sm"
              variant={filtro === valor ? "secondary" : "outline"}
              aria-pressed={filtro === valor}
              aria-label={`${rotulo}, ${porCategoria[valor] ?? 0}`}
              onClick={() => setFiltro(valor)}
              className="h-8"
            >
              {rotulo}
              <span className="tabular-nums opacity-70">{porCategoria[valor] ?? 0}</span>
            </Button>
          ))}
        </div>
      </div>

      {erroUnidades && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar as unidades do Atlas: a unidade das equipes não pode ser escolhida
          agora. Recarregue a página para tentar de novo.
        </p>
      )}

      {visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {equipes.length === 0
            ? "Nenhuma equipe do VR ainda. Elas aparecem com a primeira importação."
            : "Nenhuma equipe encontrada com esse filtro."}
        </p>
      ) : (
        // Rolagem dentro da tabela com o cabeçalho fixo, como na tabela de
        // usuários da Administração: ela encolhe até caber no que sobra da
        // tela, mas não cresce além das linhas (sem faixa vazia com poucas
        // equipes). No celular a altura fica livre e quem rola é a aba.
        <div className="scrollbar-discreta scroll-fade-x min-w-0 overflow-x-auto rounded-lg border border-border sm:min-h-40 sm:overflow-y-auto">
          <table aria-label="Equipes do VR" className="w-full min-w-[860px] table-fixed text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {COLUNAS_EQUIPES.map((coluna) => (
                  <CabecalhoOrdenavel
                    key={coluna.campo}
                    campo={coluna.campo}
                    rotulo={coluna.rotulo}
                    ordenacao={ordenacao}
                    onOrdenar={(campo) => setOrdenacao((atual) => proximaOrdenacao(atual, campo))}
                    className={cn("px-4 py-2.5", coluna.className)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((equipe) => {
                const esperando = esperandoUnidade.has(equipe.id);
                const categoria = esperando ? "unidade" : equipe.categoria;
                const comUnidade = categoria === "unidade" || categoria === "operacoes_especiais";
                const unidadeOpcional = categoria === "operacoes_especiais";
                const ocupada = salvando === equipe.id;
                const erro = erros[equipe.id]?.mensagem;
                const erroNaClassificacao = erros[equipe.id]?.campo === "classificacao";
                const erroNoTurno = erros[equipe.id]?.campo === "turno_variavel";
                const idErro = `equipe-${equipe.id}-erro`;
                return (
                  <tr key={equipe.id} className="border-b border-border align-middle last:border-0">
                    <td className="sticky left-0 z-[1] bg-background px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{equipe.nome}</span>
                        {equipe.categoria === SEM_CATEGORIA && !esperando && (
                          <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">
                            Sem categoria
                          </Badge>
                        )}
                      </div>
                      <MensagemErro id={idErro} texto={erro} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {equipe.colaboradores_ativos}
                    </td>
                    <td className="px-4 py-2.5">
                      <Select
                        // Controlado também sem categoria ("" mostra o
                        // placeholder): sem isso, uma gravação recusada
                        // deixaria o campo exibindo o que não foi salvo.
                        value={categoria === SEM_CATEGORIA ? "" : categoria}
                        onValueChange={(valor) => valor && aoMudarCategoria(equipe, valor)}
                        disabled={ocupada}
                      >
                        <SelectTrigger
                          aria-label={`Categoria de ${equipe.nome}`}
                          aria-invalid={erroNaClassificacao}
                          aria-describedby={erroNaClassificacao ? idErro : undefined}
                          className="w-full"
                        >
                          <SelectValue placeholder="Escolha a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS_EQUIPE.map((opcao) => (
                            <SelectItem key={opcao.valor} value={opcao.valor}>
                              {opcao.rotulo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5">
                      {comUnidade ? (
                        <Select
                          value={
                            esperando
                              ? ""
                              : equipe.unidade
                                ? String(equipe.unidade.id)
                                : unidadeOpcional
                                  ? SEM_UNIDADE_OPEX
                                  : ""
                          }
                          onValueChange={(valor) =>
                            valor &&
                            mudar({
                              equipe,
                              categoria,
                              unidade: valor === SEM_UNIDADE_OPEX ? null : Number(valor),
                            })
                          }
                          disabled={ocupada || carregandoUnidades || !!erroUnidades}
                        >
                          <SelectTrigger
                            aria-label={`Unidade de ${equipe.nome}`}
                            aria-invalid={esperando || erroNaClassificacao}
                            aria-describedby={erroNaClassificacao ? idErro : undefined}
                            className="w-full"
                          >
                            <SelectValue placeholder="Escolha a unidade" />
                          </SelectTrigger>
                          <SelectContent>
                            {unidadeOpcional && (
                              <SelectItem value={SEM_UNIDADE_OPEX}>Sem unidade OPEX</SelectItem>
                            )}
                            {opcoesDeUnidade(equipe, categoria).map((unidade) => (
                              <SelectItem key={unidade.id} value={String(unidade.id)}>
                                {unidade.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">Sem unidade</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Switch
                        checked={equipe.turno_variavel}
                        onCheckedChange={(marcado) => mudarTurnoVariavel(equipe, marcado)}
                        disabled={ocupada}
                        aria-label={`Turno variável de ${equipe.nome}`}
                        aria-invalid={erroNoTurno}
                        aria-describedby={erroNoTurno ? idErro : undefined}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={aConfirmar !== null}
        onOpenChange={(aberto) => !aberto && setAConfirmar(null)}
        titulo="Mudar a unidade da equipe?"
        descricao={aConfirmar ? descricaoDaConfirmacao(aConfirmar) : ""}
        textoConfirmar="Confirmar"
        onConfirmar={() => {
          if (aConfirmar) void salvar(aConfirmar.equipe, aConfirmar.categoria, aConfirmar.unidade);
          setAConfirmar(null);
        }}
      />

      <ConfirmDialog
        open={turnoAConfirmar !== null}
        onOpenChange={(aberto) => !aberto && setTurnoAConfirmar(null)}
        titulo="Ligar o turno variável?"
        descricao={
          turnoAConfirmar ? (
            <>
              O absenteísmo de <strong>{turnoAConfirmar.nome}</strong> passa a ser pela carga horária do
              dia, também nos períodos já importados. Alertas da equipe que deixarem de estar na faixa
              crítica podem ser encerrados na próxima importação.
            </>
          ) : (
            ""
          )
        }
        textoConfirmar="Ligar"
        onConfirmar={() => {
          if (turnoAConfirmar) salvarTurnoVariavel(turnoAConfirmar, true);
          setTurnoAConfirmar(null);
        }}
      />
    </section>
  );
}
