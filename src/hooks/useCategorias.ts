"use client";

import useSWR from "swr";
import { listarCategorias } from "@/lib/demandas";
import type { Categoria } from "@/types";

export function useCategorias() {
  const { data, error, isLoading } = useSWR<Categoria[]>("categorias", listarCategorias);

  return {
    categorias: data ?? [],
    isLoading,
    error,
  };
}
