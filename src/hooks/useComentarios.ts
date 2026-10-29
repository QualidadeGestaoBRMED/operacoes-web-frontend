"use client";

import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  criarComentario,
  INTERVALO_ATUALIZACAO_DEMANDAS_MS,
  listarComentarios,
} from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import type { Comentario } from "@/types";
import { ehChaveDeListaDemandas } from "./useDemandaMutations";

/**
 * De onde vêm e para onde vão os comentários de um feed: a demanda no
 * Kanban (fonteDaDemanda) ou outra rota que grava nos comentários dela, como
 * a da renovação na Legalização (STC-774). `chave` é a chave do cache SWR,
 * a mesma na leitura e no envio.
 */
export interface FonteComentarios {
  chave: readonly (string | number)[];
  listar: () => Promise<Comentario[]>;
  criar: (texto: string) => Promise<Comentario>;
  /** Outras chaves do cache que mudam com um comentário novo. */
  afetaTambem?: (chave: unknown) => boolean;
}

export function fonteDaDemanda(demandaId: number): FonteComentarios {
  return {
    chave: ["demanda", demandaId, "comentarios"],
    listar: () => listarComentarios(demandaId),
    criar: (texto) => criarComentario(demandaId, texto),
    // O card do Kanban mostra quantos comentários a demanda tem.
    afetaTambem: ehChaveDeListaDemandas,
  };
}

export function useComentariosDaFonte(fonte: FonteComentarios | null) {
  const { data, error, isLoading, mutate } = useSWR(
    fonte ? fonte.chave : null,
    () => (fonte as FonteComentarios).listar(),
    // STC-206: um comentário de outro usuário só aparecia com F5 -- key vira
    // null (sem polling) quando o modal fecha, então isso só roda com ele
    // aberto. Vale também para a conversa da Legalização e do Gestão RH.
    { refreshInterval: INTERVALO_ATUALIZACAO_DEMANDAS_MS },
  );

  return {
    comentarios: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

export function useComentarios(demandaId: number | null) {
  return useComentariosDaFonte(demandaId ? fonteDaDemanda(demandaId) : null);
}

export function useCriarComentario(fonte: FonteComentarios) {
  // Diferente de useDemandaMutations (STC-165, achado do Tech Lead): lá a
  // chave de mutação não batia com a chave parametrizada da lista, exigindo
  // um matcher via useSWRConfig(). Aqui a chave de leitura e a de mutação já
  // são idênticas (sem filtro variável), então o revalidate automático do
  // useSWRMutation (comportamento padrão) já busca a lista atualizada.
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    fonte.chave,
    (_chave, { arg }: { arg: string }) => fonte.criar(arg),
    {
      onSuccess: () => {
        if (fonte.afetaTambem) void mutate(fonte.afetaTambem);
      },
    },
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
