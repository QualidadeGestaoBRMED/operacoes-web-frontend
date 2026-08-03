"use client";

import useSWR from "swr";
import { listarModulos } from "@/lib/plataforma";
import type { Modulo } from "@/types";

export function useModulos() {
  const { data, error, isLoading } = useSWR<Modulo[]>("modulos", listarModulos);

  return {
    modulos: data ?? [],
    isLoading,
    error,
  };
}
