"use client";

import { useSWRConfig } from "swr";
import { reportarMovimentacaoProfissional } from "@/lib/legalizacao";
import { ehChaveDeListaDeDocumentos } from "./useDocumentosLegalizacao";
import type {
  DocumentoUnidade,
  MovimentacaoProfissionalPayload,
} from "@/types/legalizacao";

// Sem useSWRMutation aqui de propósito -- o modal chama isto uma vez por
// documento marcado, concorrentemente (Promise.allSettled no componente),
// pra tratar sucesso parcial por documento (critério de aceite da STC-382).
// Um único hook de mutação (chave fixa) não serve pra rastrear N chamadas
// concorrentes com resultado independente por id.
export function useReportarMovimentacaoProfissional() {
  const { mutate } = useSWRConfig();

  async function reportar(
    documentoId: number,
    payload: MovimentacaoProfissionalPayload,
  ): Promise<DocumentoUnidade> {
    const documento = await reportarMovimentacaoProfissional(
      documentoId,
      payload,
    );
    // Invalida o próprio documento (status novo), o histórico dele (a ação
    // grava historico_regulatorio, legalizacao/views.py) e a lista geral --
    // mesmo padrão de useCriarProcessoRenovacao/useAtualizarProcessoRenovacao.
    void mutate(["documento-legalizacao", documentoId]);
    void mutate(["documento-legalizacao", documentoId, "historico"]);
    void mutate(ehChaveDeListaDeDocumentos);
    return documento;
  }

  return { reportar };
}
