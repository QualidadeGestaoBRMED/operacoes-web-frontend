"use client";

import useSWR from "swr";
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

  // O lote volta pronto (concluído ou recusado) na própria resposta; o
  // histórico é recarregado para trazer também lotes do robô no meio tempo.
  async function importar(arquivos: ArquivosImportacao, inicio: string, fim: string) {
    const lote = await importarRelatorios(arquivos, inicio, fim);
    void mutate();
    return lote;
  }

  return {
    lotes: data,
    isLoading,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
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
