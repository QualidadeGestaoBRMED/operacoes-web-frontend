"use client";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { criarComentario, listarComentarios } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";

export function useComentarios(demandaId: number | null) {
  const { data, error, isLoading, mutate } = useSWR(
    demandaId ? ["demanda", demandaId, "comentarios"] : null,
    () => listarComentarios(demandaId as number),
  );

  return {
    comentarios: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

export function useCriarComentario(demandaId: number) {
  // Diferente de useDemandaMutations (STC-165, achado do Tech Lead): lá a
  // chave de mutação não batia com a chave parametrizada da lista, exigindo
  // um matcher via useSWRConfig(). Aqui a chave de leitura e a de mutação já
  // são idênticas (sem filtro variável), então o revalidate automático do
  // useSWRMutation (comportamento padrão) já busca a lista atualizada.
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", demandaId, "comentarios"],
    (_chave, { arg }: { arg: string }) => criarComentario(demandaId, arg),
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
