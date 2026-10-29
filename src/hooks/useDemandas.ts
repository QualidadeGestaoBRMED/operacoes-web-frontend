"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  buscarDemanda,
  buscarPrimeiraPaginaDaFase,
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

/** O que muda na primeira página quando a fase muda: o total e os cards do topo. */
function assinaturaDaPagina(pagina: RespostaPaginada<Demanda> | undefined) {
  if (!pagina) return "";
  return `${pagina.count}|${pagina.results.map((d) => `${d.id}:${d.updated_at}`).join(",")}`;
}

/**
 * Uma coluna do Kanban (STC-931): as demandas de uma fase, 30 por vez, na
 * ordem que o backend devolve (STC-930).
 *
 * - A **primeira página** é a única na atualização periódica (30 s).
 * - As **páginas extras** (`carregarMais`) não entram na atualização: são
 *   buscadas de novo, em paralelo, só quando a primeira mostra que a fase
 *   mudou (outro total ou outros cards no topo). Assim o custo fixo é uma
 *   busca por coluna, por mais que se tenha rolado.
 * - Trocar os filtros volta para a primeira página.
 */
export function useDemandasDaFase(
  filtros: DemandaFiltros | undefined,
  status: StatusDemanda,
  opcoes?: { pausado?: boolean; desabilitado?: boolean },
) {
  const chaveDosFiltros = JSON.stringify(filtros ?? {});
  const [paginasPedidas, setPaginasPedidas] = useState({ filtros: chaveDosFiltros, ate: 1 });
  const ate = paginasPedidas.filtros === chaveDosFiltros ? paginasPedidas.ate : 1;

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
      return pausadoRef.current ? (primeiraAtualRef.current ?? resultado) : resultado;
    },
    { keepPreviousData: true, refreshInterval: opcoes?.pausado ? 0 : INTERVALO_POLL_MS },
  );
  primeiraAtualRef.current = primeira.data;

  const extras = useSWR<PaginasExtrasDaFase & { filtros: string }>(
    opcoes?.desabilitado || ate < 2 || !primeira.data
      ? null
      : ["paginas-extras-da-fase", { ...filtros, status }, ate],
    async () => ({ ...(await listarPaginasExtrasDaFase(filtros, status, ate)), filtros: chaveDosFiltros }),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    },
  );
  // keepPreviousData também devolve o dado antigo quando a chave vira null ou
  // é de outros filtros: só valem as extras pedidas com os filtros de agora.
  const dadosExtras = ate >= 2 && extras.data?.filtros === chaveDosFiltros ? extras.data : undefined;

  // A fase mudou (outro total ou outros cards no topo): as páginas extras
  // podem ter deslocado, então são buscadas de novo, uma vez.
  const assinatura = assinaturaDaPagina(primeira.data);
  const assinaturaAnteriorRef = useRef(assinatura);
  const mutateExtras = extras.mutate;
  useEffect(() => {
    if (assinatura === assinaturaAnteriorRef.current) return;
    assinaturaAnteriorRef.current = assinatura;
    if (ate >= 2) void mutateExtras();
  }, [assinatura, ate, mutateExtras]);

  const demandas = useMemo(
    () => juntarSemRepetir(primeira.data?.results ?? [], dadosExtras?.demandas ?? []),
    [primeira.data, dadosExtras],
  );
  const trocandoFiltro = useValidandoPorTrocaDeChave(filtros, primeira.isValidating);
  const temMais = ate < 2 ? Boolean(primeira.data?.next) : (dadosExtras?.temMais ?? true);
  const carregandoMais = ate >= 2 && !extras.error && (dadosExtras?.ate ?? 1) < ate && temMais;

  const carregarMais = useCallback(() => {
    if (!temMais || carregandoMais || extras.error) return;
    setPaginasPedidas({ filtros: chaveDosFiltros, ate: ate + 1 });
  }, [temMais, carregandoMais, extras.error, chaveDosFiltros, ate]);

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

  /** Põe um card na posição dele na coluna, na hora (STC-931). */
  const inserir = useCallback(
    (demanda: Demanda) => {
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
    },
    [demandas, status, temMais, primeira.data, dadosExtras, mutatePrimeira, mutateExtras],
  );

  return {
    demandas,
    total: primeira.data?.count ?? 0,
    temMais,
    carregandoMais,
    carregarMais,
    /** Falha ao buscar as páginas extras: fica na coluna, o resto do quadro segue. */
    erroAoCarregarMais: extras.error ? extrairMensagemErro(extras.error) : null,
    tentarDeNovo: () => void mutateExtras(),
    remover,
    inserir,
    /** Busca a primeira página de novo; as extras seguem se a fase mudou. */
    revalidar: () => void mutatePrimeira(),
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
