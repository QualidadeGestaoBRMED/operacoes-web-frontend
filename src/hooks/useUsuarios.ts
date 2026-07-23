"use client";

import useSWR from "swr";
import { listarUsuarios } from "@/lib/plataforma";
import type { Usuario } from "@/types";

export function useUsuarios(unidadeId?: number) {
  const { data, error, isLoading } = useSWR<Usuario[]>(["usuarios", unidadeId], () =>
    listarUsuarios(unidadeId),
  );

  return {
    usuarios: data ?? [],
    isLoading,
    error,
  };
}
