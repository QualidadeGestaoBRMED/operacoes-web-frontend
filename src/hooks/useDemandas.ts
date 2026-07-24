"use client";

import useSWR from "swr";
import { buscarDemanda, listarDemandas } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import type { Demanda, DemandaFiltros } from "@/types";

// STC-206: sem isso, uma mudança feita por outro usuário (novo card, card
// mudando de coluna) só aparecia com F5. pausado (achado no review):
// enquanto uma demanda está sendo arrastada, um refresh em segundo plano
// reordenaria a lista debaixo do cursor -- @dnd-kit não lida bem com isso.
const INTERVALO_POLL_MS = 10_000;

export function useDemandas(filtros?: DemandaFiltros, opcoes?: { pausado?: boolean }) {
  // keepPreviousData: sem isso, trocar um filtro fazia data virar
  // undefined na hora -- o board inteiro sumia e reaparecia (chave nova do
  // SWR = sem cache, mesmo já tendo os dados da consulta anterior na
  // tela). Com isso, o board continua mostrando os dados antigos
  // (levemente esmaecidos via isValidating) até os novos chegarem, em vez
  // de colapsar pra um "carregando" genérico.
  const { data, error, isLoading, isValidating, mutate } = useSWR<Demanda[]>(
    ["demandas", filtros],
    () => listarDemandas(filtros),
    { keepPreviousData: true, refreshInterval: opcoes?.pausado ? 0 : INTERVALO_POLL_MS },
  );

  return {
    demandas: data ?? [],
    isLoading,
    isValidating,
    // isLoading é por chave de cache -- a primeira vez que uma combinação
    // de filtro é usada, isLoading vem true mesmo com keepPreviousData
    // ativo (ele só afeta o "data" retornado, não esse flag). O sinal
    // certo pra saber se já existe ALGUM dado pra mostrar (mesmo que
    // desatualizado, de um filtro anterior) é o "data" bruto ainda ser
    // undefined -- só acontece na primeiríssima consulta deste hook,
    // nunca de novo depois, mesmo trocando pra uma chave inédita.
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
