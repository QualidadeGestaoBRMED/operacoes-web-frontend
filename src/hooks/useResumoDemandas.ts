"use client";

import useSWR from "swr";
import { buscarResumoDemandas } from "@/lib/demandas";
import type { DemandaFiltros, ResumoDemandas } from "@/types";

export function useResumoDemandas(filtros?: DemandaFiltros) {
  // keepPreviousData: mesmo motivo do useDemandas -- sem isso, trocar um
  // filtro fazia os cards de KPI virarem skeleton e reaparecerem do zero.
  const { data, error, isLoading, isValidating } = useSWR<ResumoDemandas>(
    ["resumo-demandas", filtros],
    () => buscarResumoDemandas(filtros),
    { keepPreviousData: true },
  );

  return {
    resumo: data,
    isLoading,
    isValidating,
    // Ver comentário equivalente em useDemandas.ts -- isLoading é por
    // chave, não reflete o fallback do keepPreviousData.
    carregandoPrimeiraVez: data === undefined,
    error,
  };
}
