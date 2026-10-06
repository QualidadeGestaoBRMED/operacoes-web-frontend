"use client";

import useSWR, { useSWRConfig } from "swr";
import { extrairMensagemErro } from "@/lib/erros";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";
import {
  adiarProgramacao,
  buscarColaboradorRH,
  buscarFeriasColaborador,
  buscarPainelFerias,
  programarFerias,
  registrarRhAcionado,
} from "@/lib/gestaoRHFerias";
import type {
  FeriasColaborador,
  FiltrosPainelFerias,
  ProgramarFeriasPayload,
} from "@/types/gestaoRH";

const PREFIXO_PAINEL = "gestao-rh-painel-ferias";

function ehChaveDoPainel(chave: unknown) {
  return Array.isArray(chave) && chave[0] === PREFIXO_PAINEL;
}

export function usePainelFerias(filtros: FiltrosPainelFerias) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    [PREFIXO_PAINEL, filtros],
    () => buscarPainelFerias(filtros),
    { keepPreviousData: true },
  );
  return {
    painel: data,
    carregandoPrimeiraVez: data === undefined && !error,
    // Filtro trocado e a resposta nova ainda não chegou: mesmo sinal do Kanban.
    trocandoFiltro: useValidandoPorTrocaDeChave(filtros, isValidating),
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
  };
}

export function useColaboradorRH(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id === null ? null : ["gestao-rh-colaborador", id],
    () => buscarColaboradorRH(id as number),
  );
  return {
    colaborador: data,
    isLoading,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
  };
}

// As ações devolvem a aba já atualizada: o cache dela é trocado pela
// resposta, e o painel (linhas e cards) e o cabeçalho do modal (alertas
// pendentes) são revalidados.
export function useFeriasColaborador(id: number | null) {
  const { mutate: mutateGlobal } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR(
    id === null ? null : ["gestao-rh-colaborador-ferias", id],
    () => buscarFeriasColaborador(id as number),
  );

  async function aplicar(acao: Promise<FeriasColaborador>) {
    const atualizada = await acao;
    await mutate(atualizada, { revalidate: false });
    void mutateGlobal(ehChaveDoPainel);
    if (id !== null) void mutateGlobal(["gestao-rh-colaborador", id]);
    return atualizada;
  }

  return {
    ferias: data,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
    programar: (periodoId: number, payload: ProgramarFeriasPayload) =>
      aplicar(programarFerias(periodoId, payload)),
    adiar: (periodoId: number, justificativa: string) =>
      aplicar(adiarProgramacao(periodoId, justificativa)),
    registrarRhAcionado: (periodoId: number) => aplicar(registrarRhAcionado(periodoId)),
  };
}
