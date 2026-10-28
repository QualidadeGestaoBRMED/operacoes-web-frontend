"use client";

import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  atualizarTipoDocumento,
  criarTipoDocumento,
  listarHistoricoTipoDocumento,
  listarTiposDocumento,
} from "@/lib/legalizacaoCatalogo";
import { extrairMensagemErro } from "@/lib/erros";
import type { Rede } from "@/types";
import type { TipoDocumentoRegulatorioPayload } from "@/types/legalizacao";

const CHAVE_LISTA = "tipos-documento-legalizacao";

// Toda variação da lista (por rede ou sem) -- criar ou editar um tipo pode
// mudar qualquer uma delas.
function ehChaveDaLista(chave: unknown) {
  return Array.isArray(chave) && chave[0] === CHAVE_LISTA;
}

/** Sem `rede`, todos os tipos; com ela, o catálogo da rede (STC-904). */
export function useTiposDocumento(rede?: Rede) {
  const { data, error, isLoading } = useSWR([CHAVE_LISTA, rede], () =>
    listarTiposDocumento(rede),
  );

  return {
    tiposDocumento: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useCriarTipoDocumento() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    CHAVE_LISTA,
    (_chave, { arg }: { arg: TipoDocumentoRegulatorioPayload }) =>
      criarTipoDocumento(arg),
    { onSuccess: () => mutate(ehChaveDaLista) },
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useAtualizarTipoDocumento() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    CHAVE_LISTA,
    (
      _chave,
      {
        arg,
      }: {
        arg: { id: number; payload: Partial<TipoDocumentoRegulatorioPayload> };
      },
    ) => atualizarTipoDocumento(arg.id, arg.payload),
    { onSuccess: () => mutate(ehChaveDaLista) },
  );

  return {
    atualizar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useHistoricoTipoDocumento(id: number | null) {
  const { data, error, isLoading } = useSWR(
    id ? ["tipo-documento-legalizacao", id, "historico"] : null,
    () => listarHistoricoTipoDocumento(id as number),
  );

  return {
    historico: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
