"use client";

import useSWR from "swr";
import { buscarDocumentoLegalizacao, listarDocumentosLegalizacao } from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";
import type { DocumentoUnidade, DocumentoUnidadeFiltros } from "@/types/legalizacao";

// Mesmo valor de useDemandas.ts (MP001) -- sem uma tela consumindo ainda
// (STC-377 é só tipos/hooks), não há motivo pra divergir do padrão já
// validado lá.
const INTERVALO_POLL_MS = 10_000;

export function useDocumentosLegalizacao(
  filtros?: DocumentoUnidadeFiltros,
  opcoes?: { pausado?: boolean; desabilitado?: boolean },
) {
  // keepPreviousData/desabilitado: mesmo motivo de useDemandas.ts -- evita
  // a lista colapsar pra "carregando" a cada troca de filtro, e evita
  // mostrar um resultado sem filtro nenhum antes da 1ª consulta de verdade
  // resolver, quando desabilitado por alguma dependência ainda não pronta.
  const { data, error, isLoading, isValidating, mutate } = useSWR<DocumentoUnidade[]>(
    opcoes?.desabilitado ? null : ["documentos-legalizacao", filtros],
    () => listarDocumentosLegalizacao(filtros),
    { keepPreviousData: true, refreshInterval: opcoes?.pausado ? 0 : INTERVALO_POLL_MS },
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
