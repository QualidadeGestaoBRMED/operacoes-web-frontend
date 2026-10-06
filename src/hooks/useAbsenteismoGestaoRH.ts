"use client";

import useSWR from "swr";
import { extrairMensagemErro } from "@/lib/erros";
import { buscarPainelAbsenteismo } from "@/lib/gestaoRHAbsenteismo";
import type { FiltrosPainelAbsenteismo } from "@/types/gestaoRH";

export function usePainelAbsenteismo(filtros: FiltrosPainelAbsenteismo) {
  const { data, error, isLoading, mutate } = useSWR(
    ["gestao-rh-painel-absenteismo", filtros],
    () => buscarPainelAbsenteismo(filtros),
    { keepPreviousData: true },
  );
  return {
    painel: data,
    carregandoPrimeiraVez: data === undefined && !error,
    isLoading,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
  };
}
