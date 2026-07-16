"use client";

import useSWRMutation from "swr/mutation";
import { atualizarDemanda, atualizarStatusDemanda, criarDemanda } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import type { DemandaPayload, DemandaStatusPayload } from "@/types";

export function useCriarDemanda() {
  const { trigger, isMutating, error } = useSWRMutation(
    "demandas",
    (_chave, { arg }: { arg: DemandaPayload }) => criarDemanda(arg),
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useAtualizarDemanda(id: number) {
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", id],
    (_chave, { arg }: { arg: Partial<DemandaPayload> }) => atualizarDemanda(id, arg),
  );

  return {
    atualizar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useAtualizarStatusDemanda(id: number) {
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", id, "status"],
    (_chave, { arg }: { arg: DemandaStatusPayload }) => atualizarStatusDemanda(id, arg),
  );

  return {
    atualizarStatus: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
