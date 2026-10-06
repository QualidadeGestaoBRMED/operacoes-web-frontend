"use client";

import useSWR from "swr";
import { extrairMensagemErro } from "@/lib/erros";
import { buscarPainelAbsenteismo } from "@/lib/gestaoRHAbsenteismo";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";
import type { FiltrosPainelAbsenteismo } from "@/types/gestaoRH";

export function usePainelAbsenteismo(filtros: FiltrosPainelAbsenteismo) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ["gestao-rh-painel-absenteismo", filtros],
    () => buscarPainelAbsenteismo(filtros),
    { keepPreviousData: true },
  );
  return {
    painel: data,
    carregandoPrimeiraVez: data === undefined && !error,
    // Filtro trocado e a resposta nova ainda não chegou (os dados na tela são
    // do filtro anterior): mesmo sinal do Kanban.
    trocandoFiltro: useValidandoPorTrocaDeChave(filtros, isValidating),
    isLoading,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
  };
}
