"use client";

import useSWR from "swr";
import { listarHistoricoLegalizacao } from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import type { HistoricoRegulatorio } from "@/types/legalizacao";

export function useHistoricoLegalizacao(documentoId: number | null) {
  const { data, error, isLoading } = useSWR<HistoricoRegulatorio[]>(
    documentoId ? ["documento-legalizacao", documentoId, "historico"] : null,
    () => listarHistoricoLegalizacao(documentoId as number),
  );

  return {
    historico: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
