"use client";

import useSWR from "swr";
import { listarEvidenciasLegalizacao } from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import type { EvidenciaRegulatoria } from "@/types/legalizacao";

export function useEvidenciasLegalizacao(documentoId: number | null) {
  const { data, error, isLoading } = useSWR<EvidenciaRegulatoria[]>(
    documentoId ? ["documento-legalizacao", documentoId, "evidencias"] : null,
    () => listarEvidenciasLegalizacao(documentoId as number),
  );

  return {
    evidencias: data ?? [],
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
