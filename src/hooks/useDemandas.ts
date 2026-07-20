"use client";

import useSWR from "swr";
import { buscarDemanda, listarDemandas } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import type { Demanda, DemandaFiltros } from "@/types";

export function useDemandas(filtros?: DemandaFiltros) {
  const { data, error, isLoading, mutate } = useSWR<Demanda[]>(["demandas", filtros], () =>
    listarDemandas(filtros),
  );

  return {
    demandas: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

export function useDemanda(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR<Demanda>(id ? ["demanda", id] : null, () =>
    buscarDemanda(id as number),
  );

  return {
    demanda: data,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}
