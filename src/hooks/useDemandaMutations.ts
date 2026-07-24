"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { atualizarDemanda, atualizarStatusDemanda, criarDemanda } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import type { DemandaPayload, DemandaStatusPayload } from "@/types";

// Achado no review: as mutações disparavam a chamada mas nunca invalidavam
// o cache do SWR -- listas e detalhes continuavam mostrando dado velho após
// salvar/mudar status. Usamos um matcher (em vez de comparar chave exata)
// porque a chave de leitura da lista é ["demandas", filtros] (parametrizada
// por filtro), então uma chave fixa como "demandas" nunca bateria com ela.
function ehChaveDeListaDemandas(chave: unknown) {
  return Array.isArray(chave) && chave[0] === "demandas";
}

export function useCriarDemanda() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "demandas",
    (_chave, { arg }: { arg: DemandaPayload }) => criarDemanda(arg),
    { onSuccess: () => mutate(ehChaveDeListaDemandas) },
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useAtualizarDemanda(id: number) {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", id],
    (_chave, { arg }: { arg: Partial<DemandaPayload> }) => atualizarDemanda(id, arg),
    {
      onSuccess: () => {
        mutate(["demanda", id]);
        mutate(ehChaveDeListaDemandas);
        // Achado no review do Tech Lead (mesmo bug já corrigido em
        // useAtualizarStatusDemanda/useResponsaveis.ts): sem isso, os campos
        // alterados só apareciam na aba Histórico depois de um refresh
        // manual -- HistoricoTimeline lê uma chave separada.
        mutate(["demanda", id, "historico"]);
      },
    },
  );

  return {
    atualizar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useAtualizarStatusDemanda(id: number) {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", id, "status"],
    (_chave, { arg }: { arg: DemandaStatusPayload }) => atualizarStatusDemanda(id, arg),
    {
      onSuccess: () => {
        mutate(["demanda", id]);
        mutate(ehChaveDeListaDemandas);
        // Achado no review do Tech Lead: sem isso, a justificativa e o novo
        // evento de status não apareciam na aba Histórico logo após a
        // transição -- HistoricoTimeline lê uma chave separada
        // (["demanda", id, "historico"]), mesmo padrão já usado em
        // useResponsaveis.ts.
        mutate(["demanda", id, "historico"]);
      },
    },
  );

  return {
    atualizarStatus: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
