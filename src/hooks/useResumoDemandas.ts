"use client";

import useSWR from "swr";
import { buscarResumoDemandas } from "@/lib/demandas";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";
import type { DemandaFiltros, ResumoDemandas } from "@/types";

// STC-206: mesmo motivo/valor de useDemandas.ts -- pausado enquanto há uma
// demanda sendo arrastada no board (o KPI reagir a isso não tem por quê
// perturbar o drag-and-drop, mesmo não sendo ele mesmo alvo do arraste).
const INTERVALO_POLL_MS = 10_000;

export function useResumoDemandas(filtros?: DemandaFiltros, opcoes?: { pausado?: boolean }) {
  // keepPreviousData: mesmo motivo do useDemandas -- sem isso, trocar um
  // filtro fazia os cards de KPI virarem skeleton e reaparecerem do zero.
  const { data, error, isLoading, isValidating } = useSWR<ResumoDemandas>(
    ["resumo-demandas", filtros],
    () => buscarResumoDemandas(filtros),
    { keepPreviousData: true, refreshInterval: opcoes?.pausado ? 0 : INTERVALO_POLL_MS },
  );
  const trocandoFiltro = useValidandoPorTrocaDeChave(filtros, isValidating);

  return {
    resumo: data,
    isLoading,
    isValidating: trocandoFiltro,
    // Ver comentário equivalente em useDemandas.ts -- isLoading é por
    // chave, não reflete o fallback do keepPreviousData.
    carregandoPrimeiraVez: data === undefined,
    error,
  };
}
