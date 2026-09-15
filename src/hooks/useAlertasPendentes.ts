"use client";

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

  return {
    alertas: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}
