"use client";

import { useEffect, useRef } from "react";
import useSWR, { useSWRConfig } from "swr";
import { extrairMensagemErro } from "@/lib/erros";
import { errosDeCampo } from "@/lib/gestaoRH";
import {
  buscarAbsenteismoColaborador,
  buscarAbsenteismoMensal,
  buscarPainelAbsenteismo,
  registrarTratamento,
} from "@/lib/gestaoRHAbsenteismo";
import type {
  CategoriaPainelAbsenteismo,
  FiltrosPainelAbsenteismo,
  RegistrarTratamentoPayload,
} from "@/types/gestaoRH";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";

export function usePainelAbsenteismo(filtros: FiltrosPainelAbsenteismo) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ["gestao-rh-painel-absenteismo", filtros],
    () => buscarPainelAbsenteismo(filtros),
    { keepPreviousData: true },
  );
  return {
    painel: data,
    carregandoPrimeiraVez: data === undefined && !error,
    // Filtro trocado e a resposta nova ainda não chegou (os dados na tela são
    // do filtro anterior): mesmo sinal do Kanban.
    trocandoFiltro: useValidandoPorTrocaDeChave(filtros, isValidating),
    isLoading,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
  };
}

/**
 * Absenteísmo mês a mês de um ano, com a unidade e a categoria do Painel:
 * uma busca à rota agregada (STC-748) por ano. Só busca com `ativo` (o modal
 * aberto). Reabrir mostra na hora o que já tinha e busca a versão atual em
 * segundo plano: importação, parâmetros ou turno variável mudados em outra
 * tela da mesma sessão aparecem sem recarregar a página. Voltar para a aba
 * não busca de novo.
 */
export function useAbsenteismoMensal(
  ativo: boolean,
  ano: number,
  unidade: number | undefined,
  categoria: CategoriaPainelAbsenteismo | undefined,
) {
  const { data, error, isLoading, mutate } = useSWR(
    ativo ? ["gestao-rh-absenteismo-mensal", ano, unidade, categoria] : null,
    () => buscarAbsenteismoMensal({ ano, unidade, categoria }),
    { revalidateOnFocus: false },
  );
  return {
    mensal: data,
    carregando: isLoading,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
  };
}

// O tratamento devolve a aba já atualizada (no período do alerta); o painel e
// o cabeçalho do modal (alertas pendentes) são revalidados.
export function useAbsenteismoColaborador(
  colaboradorId: number,
  periodo: { inicio: string; fim: string },
) {
  const { mutate: mutateGlobal } = useSWRConfig();
  // Período na tela no momento em que a resposta do tratamento chega (a
  // pessoa pode trocar o período enquanto o envio está em andamento).
  const periodoNaTela = useRef(periodo);
  useEffect(() => {
    periodoNaTela.current = periodo;
  }, [periodo]);
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ["gestao-rh-colaborador-absenteismo", colaboradorId, periodo],
    () => buscarAbsenteismoColaborador(colaboradorId, periodo),
    { keepPreviousData: true },
  );

  // Painel e cabeçalho do modal (alertas pendentes) mudam junto com o alerta.
  function revalidarPainelECabecalho() {
    void mutateGlobal(
      (chave) => Array.isArray(chave) && chave[0] === "gestao-rh-painel-absenteismo",
    );
    void mutateGlobal(["gestao-rh-colaborador", colaboradorId]);
  }

  async function registrar(payload: RegistrarTratamentoPayload) {
    let atualizada;
    try {
      atualizada = await registrarTratamento(colaboradorId, payload);
    } catch (falha) {
      // Alerta tratado por outra pessoa ou encerrado pela importação desde
      // que a aba carregou: a aba, o painel e o cabeçalho são buscados de
      // novo para mostrar como estão.
      if (errosDeCampo(falha).alerta) {
        void mutate();
        revalidarPainelECabecalho();
      }
      throw falha;
    }
    // A resposta vem no período do alerta; só substitui o cache se for o
    // período na tela agora. Senão, busca de novo o período na tela.
    const naTela = periodoNaTela.current;
    const chave = ["gestao-rh-colaborador-absenteismo", colaboradorId, naTela];
    const mesmoPeriodo =
      atualizada.periodo.inicio === naTela.inicio && atualizada.periodo.fim === naTela.fim;
    await (mesmoPeriodo
      ? mutateGlobal(chave, atualizada, { revalidate: false })
      : mutateGlobal(chave));
    revalidarPainelECabecalho();
    return atualizada;
  }

  return {
    aba: data,
    isLoading,
    trocandoPeriodo: useValidandoPorTrocaDeChave(periodo, isValidating),
    mensagemErro: error ? extrairMensagemErro(error) : null,
    recarregar: () => void mutate(),
    registrarTratamento: registrar,
  };
}
