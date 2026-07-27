"use client";

import useSWR from "swr";
import { listarHistorico } from "@/lib/demandas";
import { extrairMensagemErro } from "@/lib/erros";

// Só leitura -- histórico é escrito pelo backend (registrar_historico), nunca
// pelo cliente, então não existe hook de mutação equivalente aqui.
export function useHistorico(demandaId: number | null) {
  const { data, error, isLoading } = useSWR(
    demandaId ? ["demanda", demandaId, "historico"] : null,
    () => listarHistorico(demandaId as number),
    // STC-206: mesmo motivo de useComentarios -- só roda com o modal aberto.
    { refreshInterval: 10_000 },
  );

  return {
    historico: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
