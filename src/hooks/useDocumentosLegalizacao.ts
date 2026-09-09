"use client";

import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  atualizarDocumentoLegalizacao,
  buscarDocumentoLegalizacao,
  criarDocumentoLegalizacao,
  enviarEvidenciaLegalizacao,
  listarDocumentosLegalizacao,
} from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";
import type {
  DocumentoUnidade,
  DocumentoUnidadeFiltros,
  DocumentoUnidadePayload,
} from "@/types/legalizacao";

// Chave raiz usada por toda variação de filtro de useDocumentosLegalizacao
// (["documentos-legalizacao", filtros]) -- mutate() com este prefixo
// (predicate abaixo) invalida TODAS as combinações de filtro já em cache de
// uma vez, sem precisar saber qual filtro cada tela está usando agora.
const PREFIXO_CHAVE_LISTA = "documentos-legalizacao";

function ehChaveDeListaDeDocumentos(chave: unknown) {
  return Array.isArray(chave) && chave[0] === PREFIXO_CHAVE_LISTA;
}

// Diferente de useDemandas.ts (10s, MP001) de propósito -- achado na STC-378:
// documento regulatório muda de status raras vezes (não é um board vivo com
// gente arrastando card o tempo todo), então não se justifica o mesmo custo
// de polling agressivo. 60s reduz as chamadas em 6x sem perder nada de
// prático -- ninguém precisa saber que um alvará venceu com 10s de atraso.
const INTERVALO_POLL_MS = 60_000;

export function useDocumentosLegalizacao(
  filtros?: DocumentoUnidadeFiltros,
  opcoes?: { pausado?: boolean; desabilitado?: boolean },
) {
  // keepPreviousData/desabilitado: mesmo motivo de useDemandas.ts -- evita
  // a lista colapsar pra "carregando" a cada troca de filtro, e evita
  // mostrar um resultado sem filtro nenhum antes da 1ª consulta de verdade
  // resolver, quando desabilitado por alguma dependência ainda não pronta.
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    DocumentoUnidade[]
  >(
    opcoes?.desabilitado ? null : ["documentos-legalizacao", filtros],
    () => listarDocumentosLegalizacao(filtros),
    {
      keepPreviousData: true,
      refreshInterval: opcoes?.pausado ? 0 : INTERVALO_POLL_MS,
    },
  );
  const trocandoFiltro = useValidandoPorTrocaDeChave(filtros, isValidating);

  return {
    documentos: data ?? [],
    isLoading,
    isValidating,
    isFilterChangeValidating: trocandoFiltro,
    carregandoPrimeiraVez: data === undefined,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

export function useDocumentoLegalizacao(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR<DocumentoUnidade>(
    id ? ["documento-legalizacao", id] : null,
    () => buscarDocumentoLegalizacao(id as number),
    { refreshInterval: INTERVALO_POLL_MS },
  );

  return {
    documento: data,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

export function useCriarDocumentoLegalizacao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "criar-documento-legalizacao",
    (_chave, { arg }: { arg: DocumentoUnidadePayload }) =>
      criarDocumentoLegalizacao(arg),
    { onSuccess: () => mutate(ehChaveDeListaDeDocumentos) },
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

// Usado hoje só pra recolocar `regra_aplicada` depois de uma nova versão de
// regra (ver FormNovaVersaoRegra.tsx) -- PATCH parcial.
export function useAtualizarDocumentoLegalizacao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "atualizar-documento-legalizacao",
    (
      _chave,
      {
        arg,
      }: { arg: { id: number; payload: Partial<DocumentoUnidadePayload> } },
    ) => atualizarDocumentoLegalizacao(arg.id, arg.payload),
    { onSuccess: () => mutate(ehChaveDeListaDeDocumentos) },
  );

  return {
    atualizar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

export function useEnviarEvidenciaLegalizacao(documentoId: number) {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    ["documento-legalizacao", documentoId, "evidencias"],
    (_chave, { arg }: { arg: File }) =>
      enviarEvidenciaLegalizacao(documentoId, arg),
    { onSuccess: () => mutate(ehChaveDeListaDeDocumentos) },
  );

  return {
    enviar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
