"use client";

import useSWR from "swr";
import { inicioDoPeriodo } from "@/lib/acessos";
import { listarAcessos } from "@/lib/plataforma";
import type { Acessos } from "@/types";

/** Acessos dos últimos `dias` dias, hoje incluído (STC-746). */
export function useAcessos(dias: number) {
  const inicio = inicioDoPeriodo(dias);
  const { data, error, isLoading } = useSWR<Acessos>(["acessos", inicio], () =>
    listarAcessos(inicio),
  );

  return { acessos: data, isLoading, error };
}
