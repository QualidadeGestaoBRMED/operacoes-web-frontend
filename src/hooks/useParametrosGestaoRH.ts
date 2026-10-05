"use client";

import useSWR from "swr";
import {
  buscarParametrosAbsenteismo,
  buscarReguaFerias,
  salvarParametrosAbsenteismo,
  salvarReguaFerias,
} from "@/lib/gestaoRH";
import { extrairMensagemErro } from "@/lib/erros";
import type { MarcoEditado, NovaVersaoParametrosPayload } from "@/types/gestaoRH";

const CHAVE_PARAMETROS = "gestao-rh-parametros-absenteismo";
const CHAVE_REGUA = "gestao-rh-regua-ferias";

// O POST devolve o mesmo corpo do GET (versão vigente + versões): o cache é
// trocado pela resposta, sem uma segunda requisição.
export function useParametrosAbsenteismo() {
  const { data, error, isLoading, mutate } = useSWR(CHAVE_PARAMETROS, buscarParametrosAbsenteismo);

  async function salvar(payload: NovaVersaoParametrosPayload) {
    const resultado = await salvarParametrosAbsenteismo(payload);
    await mutate(resultado.dados, { revalidate: false });
    return resultado;
  }

  return {
    vigente: data?.vigente ?? null,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
    salvar,
  };
}

export function useReguaFerias() {
  const { data, error, isLoading, mutate } = useSWR(CHAVE_REGUA, buscarReguaFerias);

  async function salvar(marcos: MarcoEditado[]) {
    const resultado = await salvarReguaFerias(marcos);
    await mutate(resultado.dados, { revalidate: false });
    return resultado;
  }

  return {
    // undefined até carregar: uma lista vazia nova a cada render dispararia
    // de novo quem observa `marcos` num efeito.
    marcos: data?.marcos,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
    salvar,
  };
}
