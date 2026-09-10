"use client";

import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  atualizarProcessoRenovacao,
  criarProcessoRenovacao,
  listarProcessosRenovacao,
} from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import { ehChaveDeListaDeDocumentos } from "./useDocumentosLegalizacao";
import type {
  ProcessoRenovacao,
  ProcessoRenovacaoAtualizacaoPayload,
  ProcessoRenovacaoPayload,
} from "@/types/legalizacao";

// Chave da lista de processos de UM documento -- exportada pro predicate de
// invalidação abaixo não desalinhar se mudar num lugar só.
function chaveProcessosDoDocumento(documentoId: number) {
  return ["processos-renovacao", documentoId] as const;
}

export function useCriarProcessoRenovacao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "criar-processo-renovacao",
    (_chave, { arg }: { arg: ProcessoRenovacaoPayload }) =>
      criarProcessoRenovacao(arg),
    {
      // Achado numa análise de falhas críticas (STC-380): sem isto, criar o
      // processo move o documento pra Em andamento (efeito colateral no
      // backend), mas a Matriz por trás do modal continuava mostrando o
      // status antigo até o próximo poll (até 60s) -- mesmo padrão de
      // invalidação já usado por useCriarDocumentoLegalizacao/
      // useAtualizarDocumentoLegalizacao (useDocumentosLegalizacao.ts).
      // Também invalida a lista de processos deste documento (STC-381) --
      // senão o modal só veria o processo recém-criado no próximo poll.
      onSuccess: (processo: ProcessoRenovacao) => {
        void mutate(ehChaveDeListaDeDocumentos);
        void mutate(chaveProcessosDoDocumento(processo.documento_unidade.id));
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

// Sem hook de leitura por documento_unidade "só o ativo" -- um documento
// pode ter histórico de processos concluídos, e a Solicitação (STC-381)
// não distingue os dois casos por enquanto, então a lista completa (mais
// recente primeiro, Meta.ordering do model) já resolve achar o ativo (o
// primeiro que não está concluído -- no máximo um, por UniqueConstraint).
export function useProcessosRenovacao(documentoId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<ProcessoRenovacao[]>(
    documentoId ? chaveProcessosDoDocumento(documentoId) : null,
    () => listarProcessosRenovacao(documentoId as number),
  );

  return {
    processoAtivo:
      data?.find((processo) => processo.status !== "concluido") ?? null,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

export function useAtualizarProcessoRenovacao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "atualizar-processo-renovacao",
    (
      _chave,
      {
        arg,
      }: {
        arg: { id: number; payload: ProcessoRenovacaoAtualizacaoPayload };
      },
    ) => atualizarProcessoRenovacao(arg.id, arg.payload),
    {
      // Mesmo motivo do onSuccess de useCriarProcessoRenovacao acima --
      // "Salvar protocolo" (em_andamento -> protocolado) e "Concluir
      // renovação" (-> regular) também mudam DocumentoUnidade.status como
      // efeito colateral (_sincronizar_documento, legalizacao/views.py).
      onSuccess: (processo: ProcessoRenovacao) => {
        void mutate(ehChaveDeListaDeDocumentos);
        void mutate(chaveProcessosDoDocumento(processo.documento_unidade.id));
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
