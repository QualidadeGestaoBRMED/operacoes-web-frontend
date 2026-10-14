"use client";

import { useEffect, useRef } from "react";
import useSWR, { useSWRConfig } from "swr";
import { extrairMensagemErro } from "@/lib/erros";
import { errosDeCampo } from "@/lib/gestaoRH";
import {
  buscarAbsenteismoColaborador,
  buscarPainelAbsenteismo,
  mesesDoAno,
  registrarTratamento,
  type MesDoAno,
} from "@/lib/gestaoRHAbsenteismo";
import type {
  CategoriaPainelAbsenteismo,
  FiltrosPainelAbsenteismo,
  PainelAbsenteismo,
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

export interface MesAbsenteismo extends MesDoAno {
  /** Nulo nos meses não buscados (futuros ou antes dos dados do Atlas). */
  painel: PainelAbsenteismo | null;
}

// Buscas simultâneas do mês a mês. O backend de produção roda com um processo
// só e a rota do Painel é a mais pesada do módulo: doze de uma vez seguravam
// as requisições dos outros usuários; em lotes, elas entram entre um e outro.
const MESES_POR_LOTE = 3;

/**
 * Absenteísmo mês a mês de um ano, com a unidade e a categoria do Painel: uma
 * busca à rota do Painel por mês, do primeiro mês com dados ao mês atual, em
 * lotes. Só busca com `ativo` (o modal aberto), e não busca de novo ao voltar
 * para a aba nem ao reabrir o modal: os números mudam uma vez por dia, com a
 * importação. A faixa padrão só enxuga as linhas da resposta; os cards
 * contam todos.
 */
export function useAbsenteismoMensal(
  ativo: boolean,
  ano: number,
  hoje: string,
  unidade: number | undefined,
  categoria: CategoriaPainelAbsenteismo | undefined,
) {
  const { data, error, isLoading, mutate } = useSWR(
    ativo ? ["gestao-rh-absenteismo-mensal", ano, hoje, unidade, categoria] : null,
    async () => {
      const meses: MesAbsenteismo[] = mesesDoAno(ano, hoje).map((mes) => ({ ...mes, painel: null }));
      const aBuscar = meses.filter((mes) => !mes.futuro && !mes.antesDosDados);
      for (let inicio = 0; inicio < aBuscar.length; inicio += MESES_POR_LOTE) {
        await Promise.all(
          aBuscar.slice(inicio, inicio + MESES_POR_LOTE).map(async (mes) => {
            mes.painel = await buscarPainelAbsenteismo({
              inicio: mes.inicio,
              fim: mes.fim,
              unidade,
              categoria,
              faixa: ["critica", "atencao"],
            });
          }),
        );
      }
      return meses;
    },
    { revalidateOnFocus: false, revalidateIfStale: false },
  );
  return {
    meses: data,
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
