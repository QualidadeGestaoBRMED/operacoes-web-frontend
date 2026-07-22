"use client";

import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { enviarAnexo, excluirAnexo, listarAnexos } from "@/lib/demandas";
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
  const { mutate } = useSWRConfig();
  // Chave de mutação igual à de leitura -- mesmo caso de useComentarios,
  // revalidate automático do useSWRMutation já cobre a lista de anexos.
  // Histórico é uma chave diferente (não bate por igualdade) -- precisa de
  // invalidação explícita, mesmo achado do Tech Lead na STC-165.
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", demandaId, "anexos"],
    (_chave, { arg }: { arg: File }) => enviarAnexo(demandaId, arg),
    { onSuccess: () => mutate(["demanda", demandaId, "historico"]) },
  );

  return {
    enviar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useExcluirAnexo(demandaId: number) {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", demandaId, "anexos"],
    (_chave, { arg }: { arg: number }) => excluirAnexo(demandaId, arg),
    { onSuccess: () => mutate(["demanda", demandaId, "historico"]) },
  );

  return {
    excluir: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
