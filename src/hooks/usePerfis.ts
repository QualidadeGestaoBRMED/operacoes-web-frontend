"use client";

import useSWR from "swr";
import { listarPerfis } from "@/lib/plataforma";
import type { Perfil } from "@/types";

export function usePerfis() {
  const { data, error, isLoading } = useSWR<Perfil[]>("perfis", listarPerfis);

  return {
    perfis: data ?? [],
    isLoading,
    error,
  };
}
