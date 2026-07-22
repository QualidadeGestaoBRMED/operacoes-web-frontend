"use client";

import useSWR from "swr";
import { listarSetores } from "@/lib/plataforma";
import type { Setor } from "@/types";

// moduloId opcional de propósito: quem já sabe o módulo (ex.: FormNovaDemanda,
// derivando de TipoGestao.modulo) escopa a lista; sem ele, cai no
// comportamento antigo (todos os setores) só como fallback.
export function useSetores(moduloId?: number) {
  const { data, error, isLoading } = useSWR<Setor[]>(["setores", moduloId], () =>
    listarSetores(moduloId),
  );

  return {
    setores: data ?? [],
    isLoading,
    error,
  };
}
