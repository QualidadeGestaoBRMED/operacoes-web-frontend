"use client";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { enviarAnexo, listarAnexos } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";

export function useAnexos(demandaId: number | null) {
  const { data, error, isLoading, mutate } = useSWR(
    demandaId ? ["demanda", demandaId, "anexos"] : null,
    () => listarAnexos(demandaId as number),
  );

  return {
    anexos: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

export function useEnviarAnexo(demandaId: number) {
  // Chave de mutação igual à de leitura -- mesmo caso de useComentarios,
  // revalidate automático do useSWRMutation já cobre a lista.
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", demandaId, "anexos"],
    (_chave, { arg }: { arg: File }) => enviarAnexo(demandaId, arg),
  );

  return {
    enviar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
