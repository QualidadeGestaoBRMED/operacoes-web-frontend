"use client";

import useSWR, { useSWRConfig } from "swr";
import { CHAVE_EQUIPES } from "@/hooks/useParametrosGestaoRH";
import { extrairMensagemErro } from "@/lib/erros";
import {
  importarRelatorios,
  listarImportacoes,
  listarLinhasRejeitadas,
  type ArquivosImportacao,
} from "@/lib/gestaoRHImportacao";

const CHAVE_IMPORTACOES = "gestao-rh-importacoes";

export function useImportacoesVR() {
  const { data, error, isLoading, mutate } = useSWR(CHAVE_IMPORTACOES, listarImportacoes);
  const { mutate: mutateGlobal } = useSWRConfig();

  // Um lote pode criar equipes: a aba Equipes, que fica montada, busca a
  // lista de novo para o atalho "classificar na aba Equipes" mostrá-las.
  function recarregar() {
    void mutate();
    void mutateGlobal(CHAVE_EQUIPES);
  }

  // O lote volta pronto (concluído ou recusado) na própria resposta; o
  // histórico é recarregado para trazer também lotes do robô no meio tempo.
  async function importar(arquivos: ArquivosImportacao, inicio: string, fim: string) {
    const lote = await importarRelatorios(arquivos, inicio, fim);
    recarregar();
    return lote;
  }

  return {
    lotes: data,
    isLoading,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar,
    importar,
  };
}

/** Linhas rejeitadas de um lote; `null` não busca (modal fechado). */
export function useLinhasRejeitadas(loteId: number | null) {
  const { data, error, isLoading } = useSWR(
    loteId === null ? null : ["gestao-rh-importacao-rejeitadas", loteId],
    ([, id]: [string, number]) => listarLinhasRejeitadas(id),
  );
  return {
    linhas: data,
    isLoading,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
