"use client";

import useSWR from "swr";
import { extrairMensagemErro } from "@/lib/erros";
import { buscarPainelHorasExtras } from "@/lib/gestaoRHHorasExtras";
import type { FiltrosPainelHorasExtras } from "@/types/gestaoRH";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";

export function usePainelHorasExtras(filtros: FiltrosPainelHorasExtras) {
  const { data, error, isValidating, mutate } = useSWR(
    ["gestao-rh-painel-horas-extras", filtros],
    () => buscarPainelHorasExtras(filtros),
    { keepPreviousData: true },
  );
  return {
    painel: data,
    carregandoPrimeiraVez: data === undefined && !error,
    trocandoFiltro: useValidandoPorTrocaDeChave(filtros, isValidating),
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
  };
}
