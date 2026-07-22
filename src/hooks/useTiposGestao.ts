"use client";

import useSWR from "swr";
import { listarTiposGestao } from "@/lib/demandas";
import type { TipoGestao } from "@/types";

export function useTiposGestao() {
  const { data, error, isLoading } = useSWR<TipoGestao[]>("tipos-gestao", listarTiposGestao);

  return {
    tiposGestao: data ?? [],
    isLoading,
    error,
  };
}
