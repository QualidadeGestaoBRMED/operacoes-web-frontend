"use client";

import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import {
  buscarDemanda,
  INTERVALO_ATUALIZACAO_DEMANDAS_MS,
  listarDemandasDaFase,
  type PaginasDaFase,
} from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";
import type { Demanda, DemandaFiltros, StatusDemanda } from "@/types";

// STC-206: sem isso, uma mudança feita por outro usuário (novo card, card
// mudando de coluna) só aparecia com F5. pausado (achado no review):
// enquanto uma demanda está sendo arrastada, um refresh em segundo plano
// reordenaria a lista debaixo do cursor -- @dnd-kit não lida bem com isso.
const INTERVALO_POLL_MS = INTERVALO_ATUALIZACAO_DEMANDAS_MS;

/** A chave do cache de uma coluna: começa com "demandas", como a lista toda
 * fazia, para as ações que já invalidam ehChaveDeListaDemandas (criar,
 * mover, editar, comentar, anexar) atualizarem as colunas sem mudança. */
export function chaveDaFase(
  filtros: DemandaFiltros | undefined,
  status: StatusDemanda,
  paginas: number,
) {
  return ["demandas", { ...filtros, status }, paginas] as const;
}

/**
 * Uma coluna do Kanban (STC-931): as demandas de uma fase, 30 por vez, na
 * ordem que o backend devolve (STC-930). `carregarMais` pede a página
 * seguinte; as já carregadas continuam na tela enquanto ela chega
 * (keepPreviousData). Trocar os filtros volta para a primeira página.
 */
export function useDemandasDaFase(
  filtros: DemandaFiltros | undefined,
  status: StatusDemanda,
  opcoes?: { pausado?: boolean; desabilitado?: boolean },
) {
  const chaveDosFiltros = JSON.stringify(filtros ?? {});
  const [paginasPedidas, setPaginasPedidas] = useState({ filtros: chaveDosFiltros, paginas: 1 });
  const paginas = paginasPedidas.filtros === chaveDosFiltros ? paginasPedidas.paginas : 1;

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
  const dadosAtuaisRef = useRef<PaginasDaFase | undefined>(undefined);

  // keepPreviousData: trocar um filtro ou pedir mais uma página não apaga a
  // coluna; os cards de antes ficam até a resposta nova chegar.
  // desabilitado: chave null enquanto o board não sabe o tipo de gestão
  // padrão, para nunca existir uma busca sem esse filtro que o
  // keepPreviousData pudesse reaproveitar.
  const { data, error, isValidating, mutate } = useSWR<PaginasDaFase>(
    opcoes?.desabilitado ? null : chaveDaFase(filtros, status, paginas),
    async () => {
      const resultado = await listarDemandasDaFase(filtros, status, paginas);
      return pausadoRef.current ? (dadosAtuaisRef.current ?? resultado) : resultado;
    },
    { keepPreviousData: true, refreshInterval: opcoes?.pausado ? 0 : INTERVALO_POLL_MS },
  );
  dadosAtuaisRef.current = data;
  const trocandoFiltro = useValidandoPorTrocaDeChave(filtros, isValidating);
  // Pediu mais páginas do que as que já chegaram, e a fase ainda tinha mais.
  const carregandoMais = data !== undefined && data.paginas < paginas && data.temMais;

  const carregarMais = useCallback(() => {
    if (!data?.temMais || data.paginas < paginas) return;
    setPaginasPedidas({ filtros: chaveDosFiltros, paginas: paginas + 1 });
  }, [data, paginas, chaveDosFiltros]);

  return {
    demandas: data?.demandas ?? [],
    total: data?.total ?? 0,
    temMais: data?.temMais ?? false,
    carregandoMais,
    carregarMais,
    isValidating,
    isFilterChangeValidating: trocandoFiltro,
    // data só é undefined antes da primeiríssima resposta deste hook; depois,
    // keepPreviousData sempre tem algo para mostrar.
    carregandoPrimeiraVez: data === undefined,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
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
