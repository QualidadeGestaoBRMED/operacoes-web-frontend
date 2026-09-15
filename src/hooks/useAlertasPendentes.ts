"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { extrairMensagemErro } from "@/lib/erros";
import { listarAlertasPendentes } from "@/lib/legalizacao";

// STC-443: alimenta o modal de alerta persistente (AlertaPersistenteModal.tsx),
// montado uma vez no AppShell -- não por tela. Mesmo poll de 60s dos outros
// hooks de Legalização (documento regulatório não muda rápido o bastante
// pra justificar algo mais agressivo).
const INTERVALO_POLL_MS = 60_000;

export function useAlertasPendentes() {
  const { data, error, isLoading, mutate } = useSWR(
    "alertas-pendentes",
    listarAlertasPendentes,
    { refreshInterval: INTERVALO_POLL_MS },
  );

  // Achado em code review: sem isto, uma falha aqui (rede, 500 passageiro,
  // token expirando no meio da renovação silenciosa) devolvia `[]` do
  // mesmo jeito que "sem alerta nenhum" -- indistinguível pra quem
  // consome o hook (AlertaPersistenteModal.tsx). Justo o tipo de alerta que
  // a issue existe pra garantir que não passe despercebido podia sumir numa
  // falha temporária, em silêncio total. Loga pelo menos no console -- se o
  // projeto algum dia integrar error tracking (STC-238), isso já aparece lá
  // de graça.
  useEffect(() => {
    if (error) console.error("Falha ao buscar alertas regulatórios pendentes:", error);
  }, [error]);

  return {
    alertas: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}
