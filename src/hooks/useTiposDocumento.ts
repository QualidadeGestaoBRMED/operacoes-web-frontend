"use client";

import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  atualizarTipoDocumento,
  criarTipoDocumento,
  listarTiposDocumento,
} from "@/lib/legalizacaoCatalogo";
import { extrairMensagemErro } from "@/lib/erros";
import type { TipoDocumentoRegulatorioPayload } from "@/types/legalizacao";

const CHAVE_LISTA = "tipos-documento-legalizacao";

export function useTiposDocumento() {
  const { data, error, isLoading } = useSWR(CHAVE_LISTA, listarTiposDocumento);

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
    { onSuccess: () => mutate(CHAVE_LISTA) },
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
    { onSuccess: () => mutate(CHAVE_LISTA) },
  );

  return {
    atualizar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
