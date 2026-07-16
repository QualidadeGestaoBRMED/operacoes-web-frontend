"use client";

import useSWR from "swr";
import { listarUnidades } from "@/lib/plataforma";
import type { Unidade } from "@/types";

export function useUnidades() {
  const { data, error, isLoading } = useSWR<Unidade[]>("unidades", listarUnidades);

  return {
    unidades: data ?? [],
    isLoading,
    error,
  };
}
