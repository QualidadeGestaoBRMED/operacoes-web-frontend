"use client";

import useSWR from "swr";
import { inicioDoPeriodo } from "@/lib/acessos";
import { listarAcessos } from "@/lib/plataforma";
import type { Acessos } from "@/types";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";

/** Acessos dos últimos `dias` dias, hoje incluído (STC-746). */
export function useAcessos(dias: number) {
  const inicio = inicioDoPeriodo(dias);
  // keepPreviousData: trocar o período mantém a tabela anterior na tela
  // (esmaecida) até a resposta nova chegar, em vez de esvaziá-la.
  const { data, error, isValidating, mutate } = useSWR<Acessos>(
    ["acessos", inicio],
    () => listarAcessos(inicio),
    { keepPreviousData: true },
  );

  return {
    acessos: data,
    carregandoPrimeiraVez: data === undefined && !error,
    trocandoPeriodo: useValidandoPorTrocaDeChave(inicio, isValidating),
    error,
    recarregar: () => void mutate(),
  };
}
