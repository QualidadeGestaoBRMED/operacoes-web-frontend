"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  enviarAnexo,
  excluirAnexo,
  INTERVALO_ATUALIZACAO_DEMANDAS_MS,
  listarAnexos,
} from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";

export function useAnexos(demandaId: number | null) {
  const { data, error, isLoading, mutate } = useSWR(
    demandaId ? ["demanda", demandaId, "anexos"] : null,
    () => listarAnexos(demandaId as number),
    // STC-206: mesmo motivo de useComentarios -- só roda com o modal aberto.
    { refreshInterval: INTERVALO_ATUALIZACAO_DEMANDAS_MS },
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
  // Fração enviada (0 a 1) do arquivo em andamento; null fora de um envio.
  // Um anexo grande vai direto ao R2 (STC-628) e leva alguns segundos.
  const [progresso, setProgresso] = useState<number | null>(null);
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", demandaId, "anexos"],
    async (_chave, { arg }: { arg: File }) => {
      setProgresso(0);
      try {
        return await enviarAnexo(demandaId, arg, setProgresso);
      } finally {
        setProgresso(null);
      }
    },
    { onSuccess: () => mutate(["demanda", demandaId, "historico"]) },
  );

  return {
    enviar: trigger,
    isLoading: isMutating,
    progresso,
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
