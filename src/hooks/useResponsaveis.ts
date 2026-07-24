"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { adicionarResponsavel, removerResponsavel } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import type { DemandaResponsavel } from "@/types";

// Diferente de comentários/anexos/histórico, responsáveis não têm endpoint
// de leitura próprio -- já vêm embutidos no objeto Demanda (demanda.
// responsaveis). Por isso a chave de mutação é ["demanda", demandaId], a
// mesma de useDemanda: o revalidate automático do useSWRMutation já busca a
// demanda de novo (com a lista de responsáveis atualizada), sem precisar de
// uma chave de leitura separada.
export function useAdicionarResponsavel(demandaId: number) {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", demandaId],
    (_chave, { arg }: { arg: { usuario_id: number; tipo: DemandaResponsavel["tipo"] } }) =>
      adicionarResponsavel(demandaId, arg),
    { onSuccess: () => mutate(["demanda", demandaId, "historico"]) },
  );

  return {
    adicionar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useRemoverResponsavel(demandaId: number) {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", demandaId],
    (_chave, { arg }: { arg: number }) => removerResponsavel(demandaId, arg),
    { onSuccess: () => mutate(["demanda", demandaId, "historico"]) },
  );

  return {
    remover: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
