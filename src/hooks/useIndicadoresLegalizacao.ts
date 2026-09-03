"use client";

import useSWR from "swr";
import { buscarIndicadoresLegalizacao } from "@/lib/legalizacao";
import type { IndicadoresLegalizacao } from "@/types/legalizacao";

// Mesmo valor de useResumoDemandas.ts (MP001).
const INTERVALO_POLL_MS = 10_000;

export function useIndicadoresLegalizacao(opcoes?: { pausado?: boolean }) {
  // keepPreviousData: mesmo motivo de useResumoDemandas.ts -- sem isso, os
  // cards de indicador virariam skeleton a cada poll/revalidação em vez de
  // só atualizar o número.
  const { data, error, isLoading, isValidating } = useSWR<IndicadoresLegalizacao>(
    "indicadores-legalizacao",
    buscarIndicadoresLegalizacao,
    { keepPreviousData: true, refreshInterval: opcoes?.pausado ? 0 : INTERVALO_POLL_MS },
  );

  return {
    indicadores: data,
    isLoading,
    isValidating,
    carregandoPrimeiraVez: data === undefined,
    error,
  };
}
