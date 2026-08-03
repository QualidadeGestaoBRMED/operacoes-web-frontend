"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  adicionarResponsavel,
  removerResponsavel,
  trocarPrincipalResponsavel,
} from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import { ehChaveDeListaDemandas } from "@/hooks/useDemandaMutations";
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
    {
      onSuccess: () => {
        mutate(["demanda", demandaId, "historico"]);
        // Achado construindo a suíte E2E (STC-216): sem isso, a lista do
        // board (KanbanBoard, chave ["demandas", filtros]) ficava com o
        // dado velho -- sem responsável -- até o próximo poll de 10s
        // (STC-206). Como sair do Backlog exige responsável principal
        // (validado no cliente contra esse mesmo dado da lista, antes de
        // chamar o backend), um usuário que atribuísse responsável e
        // tentasse mover o card na sequência via drag-and-drop via o
        // movimento "bloqueado" silenciosamente por até 10s. Mesmo padrão
        // já usado em useAtualizarDemanda/useAtualizarStatusDemanda.
        mutate(ehChaveDeListaDemandas);
      },
    },
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
    {
      onSuccess: () => {
        mutate(["demanda", demandaId, "historico"]);
        // Mesmo achado do useAdicionarResponsavel acima, simétrico.
        mutate(ehChaveDeListaDemandas);
      },
    },
  );

  return {
    remover: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useTrocarPrincipal(demandaId: number) {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    ["demanda", demandaId],
    (_chave, { arg }: { arg: { antigoUsuarioId: number; novoUsuarioId: number } }) =>
      trocarPrincipalResponsavel(demandaId, arg.antigoUsuarioId, arg.novoUsuarioId),
    { onSuccess: () => mutate(["demanda", demandaId, "historico"]) },
  );

  return {
    trocarPrincipal: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
