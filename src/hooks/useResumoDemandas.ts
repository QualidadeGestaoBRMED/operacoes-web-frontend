"use client";

import useSWR from "swr";
import { buscarResumoDemandas } from "@/lib/demandas";
import type { DemandaFiltros, ResumoDemandas } from "@/types";

export function useResumoDemandas(filtros?: DemandaFiltros) {
  const { data, error, isLoading } = useSWR<ResumoDemandas>(
    ["resumo-demandas", filtros],
    () => buscarResumoDemandas(filtros),
  );

  return {
    resumo: data,
    isLoading,
    error,
  };
}
