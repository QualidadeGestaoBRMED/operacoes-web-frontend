"use client";

import useSWR from "swr";
import { buscarIndicadoresLegalizacao } from "@/lib/legalizacao";
import type { IndicadoresLegalizacao } from "@/types/legalizacao";

// 60s (não 10s como useResumoDemandas.ts/MP001) -- mesmo motivo de
// useDocumentosLegalizacao.ts: indicador de conformidade não muda em tempo
// real como o Kanban, não se justifica o mesmo custo de polling.
const INTERVALO_POLL_MS = 60_000;

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
