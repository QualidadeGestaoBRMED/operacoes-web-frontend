"use client";

import useSWR from "swr";
import { buscarResumoDemandas } from "@/lib/demandas";
import type { ResumoDemandas } from "@/types";

export function useResumoDemandas() {
  const { data, error, isLoading } = useSWR<ResumoDemandas>(
    "resumo-demandas",
    buscarResumoDemandas,
  );

  return {
    resumo: data,
    isLoading,
    error,
  };
}
