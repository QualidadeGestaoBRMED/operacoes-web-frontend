"use client";

import useSWR, { useSWRConfig } from "swr";
import { extrairMensagemErro } from "@/lib/erros";
import {
  buscarAbsenteismoColaborador,
  buscarPainelAbsenteismo,
  registrarTratamento,
} from "@/lib/gestaoRHAbsenteismo";
import type { FiltrosPainelAbsenteismo, RegistrarTratamentoPayload } from "@/types/gestaoRH";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";

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

// O tratamento devolve a aba já atualizada (no período do alerta); o painel e
// o cabeçalho do modal (alertas pendentes) são revalidados.
export function useAbsenteismoColaborador(
  colaboradorId: number,
  periodo: { inicio: string; fim: string },
) {
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ["gestao-rh-colaborador-absenteismo", colaboradorId, periodo],
    () => buscarAbsenteismoColaborador(colaboradorId, periodo),
    { keepPreviousData: true },
  );

  async function registrar(payload: RegistrarTratamentoPayload) {
    const atualizada = await registrarTratamento(colaboradorId, payload);
    // A resposta vem no período do alerta; só substitui o cache se for o
    // período na tela. Senão, busca de novo o período na tela.
    const mesmoPeriodo =
      atualizada.periodo.inicio === periodo.inicio && atualizada.periodo.fim === periodo.fim;
    await (mesmoPeriodo ? mutate(atualizada, { revalidate: false }) : mutate());
    void mutateGlobal(
      (chave) => Array.isArray(chave) && chave[0] === "gestao-rh-painel-absenteismo",
    );
    void mutateGlobal(["gestao-rh-colaborador", colaboradorId]);
    return atualizada;
  }

  return {
    aba: data,
    isLoading,
    trocandoPeriodo: useValidandoPorTrocaDeChave(periodo, isValidating),
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
    registrarTratamento: registrar,
  };
}
