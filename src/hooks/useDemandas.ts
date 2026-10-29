"use client";

import { useRef } from "react";
import useSWR from "swr";
import {
  buscarDemanda,
  INTERVALO_ATUALIZACAO_DEMANDAS_MS,
  listarDemandas,
} from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";
import { useValidandoPorTrocaDeChave } from "./useValidandoPorTrocaDeChave";
import type { Demanda, DemandaFiltros } from "@/types";

// STC-206: sem isso, uma mudança feita por outro usuário (novo card, card
// mudando de coluna) só aparecia com F5. pausado (achado no review):
// enquanto uma demanda está sendo arrastada, um refresh em segundo plano
// reordenaria a lista debaixo do cursor -- @dnd-kit não lida bem com isso.
const INTERVALO_POLL_MS = INTERVALO_ATUALIZACAO_DEMANDAS_MS;

export function useDemandas(
  filtros?: DemandaFiltros,
  opcoes?: { pausado?: boolean; desabilitado?: boolean },
) {
  // Achado no review: pausarPolling (via refreshInterval:0 abaixo) só
  // impede um NOVO poll de ser agendado -- não cancela um que já estava em
  // voo quando o arraste começou. Se essa resposta chegar durante o drag ou
  // logo após o drop, ela ainda sobrescreveria o estado otimista (o card
  // "piscando" de volta pro lugar antigo por um instante). O fetcher checa
  // a pausa no momento em que a resposta chega (não em que a request
  // começou) e descarta o resultado nesse caso, devolvendo o que já está
  // no cache -- equivalente a abortar, sem a complexidade real de cancelar
  // a request em voo.
  const pausadoRef = useRef(opcoes?.pausado ?? false);
  pausadoRef.current = opcoes?.pausado ?? false;
  const dadosAtuaisRef = useRef<Demanda[] | undefined>(undefined);

  // keepPreviousData: sem isso, trocar um filtro fazia data virar
  // undefined na hora -- o board inteiro sumia e reaparecia (chave nova do
  // SWR = sem cache, mesmo já tendo os dados da consulta anterior na
  // tela). Com isso, o board continua mostrando os dados antigos
  // (levemente esmaecidos via isValidating) até os novos chegarem, em vez
  // de colapsar pra um "carregando" genérico.
  // desabilitado (achado ao investigar o "board mostrando os dois tipos
  // misturados" mesmo depois da guarda de loading em KanbanBoard.tsx): key
  // null em vez de só atrasar a exibição -- enquanto o board ainda não sabe
  // qual tipo_gestao é o padrão, ele nunca teria dado pra confiar mesmo
  // filtrado por undefined. Só esconder o resultado (guarda de render) não
  // bastava: quando o filtro correto chegava, o keepPreviousData reusava
  // esse resultado sem filtro (a chave mudou, mas havia dado anterior "bom o
  // suficiente" pra manter) e mostrava ele esmaecido até a busca filtrada
  // responder -- o mesmo piscar, só que através da troca de filtro em vez do
  // load inicial. Com key null, não existe fetch nenhum pra virar esse
  // "dado anterior" -- data começa e continua undefined (carregandoPrimeiraVez)
  // até a primeira busca com filtro de verdade responder.
  const { data, error, isLoading, isValidating, mutate } = useSWR<Demanda[]>(
    opcoes?.desabilitado ? null : ["demandas", filtros],
    async () => {
      const resultado = await listarDemandas(filtros);
      return pausadoRef.current ? (dadosAtuaisRef.current ?? resultado) : resultado;
    },
    { keepPreviousData: true, refreshInterval: opcoes?.pausado ? 0 : INTERVALO_POLL_MS },
  );
  dadosAtuaisRef.current = data;
  const trocandoFiltro = useValidandoPorTrocaDeChave(filtros, isValidating);

  return {
    demandas: data ?? [],
    isLoading,
    // Achado no review: mascarar isValidating aqui (só reportando troca de
    // filtro) quebrava a semântica esperada do SWR pra qualquer outro
    // consumidor deste hook -- valor bruto preservado, e a distinção de
    // "isso é troca de filtro, não polling silencioso" vira um campo à
    // parte, só pra quem realmente precisa dela (ex.: esmaecer o board).
    isValidating,
    isFilterChangeValidating: trocandoFiltro,
    // isLoading é por chave de cache -- a primeira vez que uma combinação
    // de filtro é usada, isLoading vem true mesmo com keepPreviousData
    // ativo (ele só afeta o "data" retornado, não esse flag). O sinal
    // certo pra saber se já existe ALGUM dado pra mostrar (mesmo que
    // desatualizado, de um filtro anterior) é o "data" bruto ainda ser
    // undefined -- só acontece na primeiríssima consulta deste hook,
    // nunca de novo depois, mesmo trocando pra uma chave inédita.
    carregandoPrimeiraVez: data === undefined,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

export function useDemanda(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR<Demanda>(
    id ? ["demanda", id] : null,
    () => buscarDemanda(id as number),
    { refreshInterval: INTERVALO_POLL_MS },
  );

  return {
    demanda: data,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}
