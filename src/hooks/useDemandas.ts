"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  buscarDemanda,
  buscarPrimeiraPaginaDaFase,
  ehFaseDoQuadro,
  FASES_DO_QUADRO,
  INTERVALO_ATUALIZACAO_DEMANDAS_MS,
  juntarSemRepetir,
  listarPaginasExtrasDaFase,
  type PaginasExtrasDaFase,
} from "@/lib/demandas";
import { inserirNaColuna } from "@/lib/kanban";
import { extrairMensagemErro } from "@/lib/erros";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";
import type { Demanda, DemandaFiltros, RespostaPaginada, StatusDemanda } from "@/types";

// STC-206: sem isso, uma mudança feita por outro usuário (novo card, card
// mudando de coluna) só aparecia com F5. pausado (achado no review):
// enquanto uma demanda está sendo arrastada, um refresh em segundo plano
// reordenaria a lista debaixo do cursor -- @dnd-kit não lida bem com isso.
const INTERVALO_POLL_MS = INTERVALO_ATUALIZACAO_DEMANDAS_MS;

/** A chave da primeira página de uma coluna: começa com "demandas", como a
 * lista toda fazia, para as ações que já invalidam ehChaveDeListaDemandas
 * (criar, mover, editar, comentar, anexar) atualizarem as colunas sem
 * mudança. As páginas extras têm chave própria, fora da atualização. */
export function chaveDaFase(filtros: DemandaFiltros | undefined, status: StatusDemanda) {
  return ["demandas", { ...filtros, status }] as const;
}

/** As páginas extras de uma coluna: também começa com "demandas", para
 * editar, comentar, anexar e mudar responsável atualizarem os cards que
 * estão além da primeira página. Fica fora da atualização periódica. */
function chaveDasExtras(filtros: DemandaFiltros | undefined, status: StatusDemanda) {
  return ["demandas", { ...filtros, status }, "paginas-extras"] as const;
}

/**
 * Atualização a cada 30 s das colunas do quadro (STC-969): pede a primeira
 * página das quatro no mesmo instante, e elas saem numa requisição só
 * (`buscarPrimeiraPaginaDaFase`, STC-968). Com um relógio por coluna, cada
 * uma pediria na sua hora. Como o `refreshInterval` do SWR, não busca com a
 * aba em segundo plano nem sem conexão, e pausa durante o arraste. A Lixeira
 * continua com a própria atualização.
 */
export function useAtualizacaoDoQuadro(
  filtros: DemandaFiltros | undefined,
  opcoes?: { pausado?: boolean; desabilitado?: boolean },
) {
  const { mutate } = useSWRConfig();
  const pausadoRef = useRef(opcoes?.pausado ?? false);
  pausadoRef.current = opcoes?.pausado ?? false;
  const filtrosRef = useRef(filtros);
  filtrosRef.current = filtros;
  const chaveDosFiltros = JSON.stringify(filtros ?? {});
  const desabilitado = opcoes?.desabilitado ?? false;

  useEffect(() => {
    if (desabilitado) return;
    // Com o servidor lento, a próxima atualização espera a anterior voltar,
    // como no SWR: sem isso, cada quadro aberto empilharia uma requisição a
    // cada 30 s justamente quando o servidor está sobrecarregado.
    let buscando = false;
    const relogio = setInterval(() => {
      if (buscando || pausadoRef.current) return;
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      buscando = true;
      void Promise.allSettled(
        FASES_DO_QUADRO.map((status) => mutate(chaveDaFase(filtrosRef.current, status))),
      ).finally(() => {
        buscando = false;
      });
    }, INTERVALO_POLL_MS);
    return () => clearInterval(relogio);
  }, [chaveDosFiltros, desabilitado, mutate]);
}

/** O que muda na primeira página quando a fase muda: o total e os cards do topo. */
function assinaturaDaPagina(pagina: RespostaPaginada<Demanda> | undefined) {
  if (!pagina) return "";
  return `${pagina.count}|${pagina.results.map((d) => `${d.id}:${d.updated_at}`).join(",")}`;
}

/**
 * Uma coluna do Kanban (STC-931): as demandas de uma fase, 30 por vez, na
 * ordem que o backend devolve (STC-930).
 *
 * - A **primeira página** é a única na atualização periódica (30 s): a das
 *   colunas do quadro por `useAtualizacaoDoQuadro`, as quatro juntas; a da
 *   Lixeira pelo próprio SWR.
 * - **Carregar mais** busca só a página seguinte e a junta às que já vieram.
 * - As **páginas extras** são buscadas de novo, em paralelo, quando a
 *   primeira mostra que a fase mudou (outro total ou outros cards no topo) e
 *   nas ações que atualizam a lista (editar, comentar, anexar, mover).
 * - Trocar os filtros volta para a primeira página; voltar a um filtro já
 *   visto começa de novo pela primeira, sem reaproveitar extras antigas.
 */
export function useDemandasDaFase(
  filtros: DemandaFiltros | undefined,
  status: StatusDemanda,
  opcoes?: { pausado?: boolean; desabilitado?: boolean },
) {
  const { mutate: mutateGlobal } = useSWRConfig();
  const chaveDosFiltros = JSON.stringify(filtros ?? {});
  const [paginasPedidas, setPaginasPedidas] = useState({ filtros: chaveDosFiltros, ate: 1 });
  const [carregando, setCarregando] = useState<{ filtros: string; erro: unknown } | null>(null);
  // Trocar os filtros zera a coluna: voltar a um filtro já visto começa pela
  // primeira página, sem reaproveitar páginas extras guardadas dele.
  if (paginasPedidas.filtros !== chaveDosFiltros) {
    setPaginasPedidas({ filtros: chaveDosFiltros, ate: 1 });
    setCarregando(null);
  }
  const ate = paginasPedidas.filtros === chaveDosFiltros ? paginasPedidas.ate : 1;
  const ateRef = useRef(ate);
  ateRef.current = ate;
  // As páginas extras são buscadas de novo quando a primeira página que veio
  // do servidor mudou (outro total ou outros cards no topo). Compara só o
  // que veio do servidor: tirar ou pôr um card na hora não conta.
  const assinaturaDoServidorRef = useRef<{ filtros: string; assinatura: string } | null>(null);
  const buscandoExtrasRef = useRef(false);
  const buscarExtrasDeNovoRef = useRef<() => void>(() => {});

  // Achado no review: pausarPolling (via refreshInterval:0 abaixo) só
  // impede um NOVO poll de ser agendado -- não cancela um que já estava em
  // voo quando o arraste começou. Se essa resposta chegar durante o drag ou
  // logo após o drop, ela ainda sobrescreveria o estado otimista (o card
  // "piscando" de volta pro lugar antigo por um instante). O fetcher checa
  // a pausa no momento em que a resposta chega (não em que a request
  // começou) e descarta o resultado nesse caso, devolvendo o que já está
  // no cache -- equivalente a abortar, sem a complexidade real de cancelar
  // a request em voo.
  const pausadoRef = useRef(opcoes?.pausado ?? false);
  pausadoRef.current = opcoes?.pausado ?? false;
  const primeiraAtualRef = useRef<RespostaPaginada<Demanda> | undefined>(undefined);

  // keepPreviousData: trocar um filtro não apaga a coluna; os cards de antes
  // ficam até a resposta nova chegar. desabilitado: chave null enquanto o
  // board não sabe o tipo de gestão padrão, para nunca existir uma busca sem
  // esse filtro que o keepPreviousData pudesse reaproveitar.
  const primeira = useSWR<RespostaPaginada<Demanda>>(
    opcoes?.desabilitado ? null : chaveDaFase(filtros, status),
    async () => {
      const resultado = await buscarPrimeiraPaginaDaFase(filtros, status);
      if (pausadoRef.current) return primeiraAtualRef.current ?? resultado;
      const assinatura = assinaturaDaPagina(resultado);
      const anterior = assinaturaDoServidorRef.current;
      assinaturaDoServidorRef.current = { filtros: chaveDosFiltros, assinatura };
      const faseMudou = anterior?.filtros === chaveDosFiltros && anterior.assinatura !== assinatura;
      // Se a mesma ação já está buscando as extras, não repete.
      if (faseMudou && ateRef.current >= 2 && !buscandoExtrasRef.current) {
        buscarExtrasDeNovoRef.current();
      }
      return resultado;
    },
    {
      keepPreviousData: true,
      // As colunas do quadro se atualizam juntas (useAtualizacaoDoQuadro).
      refreshInterval: opcoes?.pausado || ehFaseDoQuadro(status) ? 0 : INTERVALO_POLL_MS,
    },
  );
  primeiraAtualRef.current = primeira.data;

  // Chave só existe depois do primeiro "carregar mais" com estes filtros, que
  // já grava a página buscada no cache: aqui o fetcher só roda para buscar de
  // novo as páginas que a coluna tem (fase mudou ou ação na lista).
  const chaveExtras = chaveDasExtras(filtros, status);
  const extrasAtuaisRef = useRef<PaginasExtrasDaFase | undefined>(undefined);
  const extras = useSWR<PaginasExtrasDaFase>(
    opcoes?.desabilitado || ate < 2 ? null : chaveExtras,
    async () => {
      buscandoExtrasRef.current = true;
      try {
        const resultado = await listarPaginasExtrasDaFase(filtros, status, ateRef.current);
        return pausadoRef.current ? (extrasAtuaisRef.current ?? resultado) : resultado;
      } finally {
        buscandoExtrasRef.current = false;
      }
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false },
  );
  const dadosExtras = ate >= 2 ? extras.data : undefined;
  extrasAtuaisRef.current = dadosExtras;

  const mutateExtras = extras.mutate;
  useEffect(() => {
    buscarExtrasDeNovoRef.current = () => void mutateExtras();
  }, [mutateExtras]);

  const demandas = useMemo(
    () => juntarSemRepetir(primeira.data?.results ?? [], dadosExtras?.demandas ?? []),
    [primeira.data, dadosExtras],
  );
  const trocandoFiltro = useValidandoPorTrocaDeChave(filtros, primeira.isValidating);
  const temMais = ate < 2 ? Boolean(primeira.data?.next) : (dadosExtras?.temMais ?? false);

  const carregandoAgora = carregando?.filtros === chaveDosFiltros ? carregando : null;
  const carregandoMais = Boolean(carregandoAgora && carregandoAgora.erro === null);
  const erroAoCarregar = carregandoAgora?.erro ?? null;

  /** Busca só a página seguinte e a junta às que a coluna já tem. */
  const carregarMais = useCallback(async () => {
    if (!temMais || carregandoMais || opcoes?.desabilitado) return;
    const filtrosDaBusca = chaveDosFiltros;
    // Parte do que de fato veio: a fase pode ter encolhido desde o pedido.
    const proxima = (ate >= 2 ? (dadosExtras?.ate ?? ate) : 1) + 1;
    setCarregando({ filtros: filtrosDaBusca, erro: null });
    try {
      const nova = await listarPaginasExtrasDaFase(filtros, status, proxima, proxima);
      const anteriores = ate >= 2 ? (extrasAtuaisRef.current?.demandas ?? []) : [];
      await mutateGlobal(
        chaveExtras,
        { demandas: [...anteriores, ...nova.demandas], ate: nova.ate, temMais: nova.temMais },
        { revalidate: false },
      );
      setPaginasPedidas({ filtros: filtrosDaBusca, ate: Math.max(nova.ate, proxima - 1) });
      setCarregando(null);
    } catch (erro) {
      setCarregando({ filtros: filtrosDaBusca, erro });
    }
  }, [
    temMais,
    carregandoMais,
    opcoes?.desabilitado,
    chaveDosFiltros,
    ate,
    dadosExtras,
    filtros,
    status,
    chaveExtras,
    mutateGlobal,
  ]);

  const mutatePrimeira = primeira.mutate;
  /** Tira um card da coluna na hora (antes da resposta do backend). */
  const remover = useCallback(
    (id: number) => {
      void mutatePrimeira(
        (atual) =>
          atual && {
            ...atual,
            results: atual.results.filter((d) => d.id !== id),
            count: Math.max(atual.count - 1, 0),
          },
        { revalidate: false },
      );
      void mutateExtras(
        (atual) => atual && { ...atual, demandas: atual.demandas.filter((d) => d.id !== id) },
        { revalidate: false },
      );
    },
    [mutatePrimeira, mutateExtras],
  );

  /** Põe um card na posição dele na coluna, na hora (STC-931). Devolve se
   * ele ficou à mostra: com mais páginas e o lugar dele depois dos cards
   * carregados, só o total sobe e ele aparece quando a coluna rolar até lá. */
  const inserir = useCallback(
    (demanda: Demanda): boolean => {
      const naColuna = inserirNaColuna(demandas, demanda, status, temMais);
      const posicao = naColuna.findIndex((d) => d.id === demanda.id);
      const tamanhoDaPrimeira = primeira.data?.results.length ?? 0;
      void mutatePrimeira(
        (atual) =>
          atual && {
            ...atual,
            count: atual.count + 1,
            results:
              posicao >= 0 && (posicao <= tamanhoDaPrimeira || !dadosExtras)
                ? inserirNaColuna(atual.results, demanda, status)
                : atual.results,
          },
        { revalidate: false },
      );
      if (posicao > tamanhoDaPrimeira && dadosExtras) {
        void mutateExtras(
          (atual) =>
            atual && { ...atual, demandas: inserirNaColuna(atual.demandas, demanda, status, temMais) },
          { revalidate: false },
        );
      }
      return posicao >= 0;
    },
    [demandas, status, temMais, primeira.data, dadosExtras, mutatePrimeira, mutateExtras],
  );

  const erroDasExtras = erroAoCarregar ?? (dadosExtras ? null : (extras.error ?? null));

  return {
    demandas,
    total: primeira.data?.count ?? 0,
    temMais,
    /** Já veio mais de uma página: o fim da fase ganha "Fim da lista". */
    paginou: ate >= 2,
    carregandoMais,
    carregarMais: () => void carregarMais(),
    /** Falha ao buscar as páginas extras: fica na coluna, o resto do quadro segue. */
    erroAoCarregarMais: erroDasExtras ? extrairMensagemErro(erroDasExtras) : null,
    /** Falhou a página seguinte: busca só ela de novo; falhou a busca das extras: busca de novo. */
    tentarDeNovo: () => {
      if (erroAoCarregar) {
        setCarregando(null);
        void carregarMais();
      } else {
        void mutateExtras();
      }
    },
    remover,
    inserir,
    /** Busca de novo a coluna inteira: a primeira página e as extras que já vieram. */
    revalidar: () => {
      void mutatePrimeira();
      if (ate >= 2) void mutateExtras();
    },
    isValidating: primeira.isValidating,
    isFilterChangeValidating: trocandoFiltro,
    // data só é undefined antes da primeiríssima resposta deste hook; depois,
    // keepPreviousData sempre tem algo para mostrar.
    carregandoPrimeiraVez: primeira.data === undefined,
    error: primeira.error,
    mensagemErro: primeira.error ? extrairMensagemErro(primeira.error) : null,
  };
}

export function useDemanda(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR<Demanda>(
    id ? ["demanda", id] : null,
    () => buscarDemanda(id as number),
    { refreshInterval: INTERVALO_POLL_MS },
  );

  return {
    demanda: data,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}
