"use client";

import useSWR from "swr";
import {
  buscarParametrosAbsenteismo,
  buscarReguaFerias,
  listarEquipesVR,
  reclassificarEquipeVR,
  salvarParametrosAbsenteismo,
  salvarReguaFerias,
} from "@/lib/gestaoRH";
import { extrairMensagemErro } from "@/lib/erros";
import type { Rede } from "@/types";
import type {
  MarcoEditado,
  NovaVersaoParametrosPayload,
  ReclassificarEquipePayload,
} from "@/types/gestaoRH";

const CHAVE_PARAMETROS = "gestao-rh-parametros-absenteismo";
const CHAVE_REGUA = "gestao-rh-regua-ferias";

// O POST devolve o mesmo corpo do GET (versão vigente + versões): o cache é
// trocado pela resposta, sem uma segunda requisição. Uma versão por rede
// (STC-906).
export function useParametrosAbsenteismo(rede: Rede) {
  const { data, error, isLoading, mutate } = useSWR([CHAVE_PARAMETROS, rede], () =>
    buscarParametrosAbsenteismo(rede),
  );

  async function salvar(payload: NovaVersaoParametrosPayload) {
    const resultado = await salvarParametrosAbsenteismo(payload, rede);
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

export function useReguaFerias(rede: Rede) {
  const { data, error, isLoading, mutate } = useSWR([CHAVE_REGUA, rede], () =>
    buscarReguaFerias(rede),
  );

  async function salvar(marcos: MarcoEditado[]) {
    const resultado = await salvarReguaFerias(marcos, rede);
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

export const CHAVE_EQUIPES = "gestao-rh-equipes-vr";

// Reclassificar devolve a equipe atualizada: ela é trocada na lista em cache,
// sem buscar a lista de novo.
export function useEquipesVR() {
  const { data, error, isLoading, mutate } = useSWR(CHAVE_EQUIPES, listarEquipesVR);

  async function reclassificar(id: number, payload: ReclassificarEquipePayload) {
    const atualizada = await reclassificarEquipeVR(id, payload);
    await mutate(
      (lista) => lista?.map((equipe) => (equipe.id === id ? atualizada : equipe)),
      { revalidate: false },
    );
    return atualizada;
  }

  return {
    equipes: data,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
    reclassificar,
  };
}
