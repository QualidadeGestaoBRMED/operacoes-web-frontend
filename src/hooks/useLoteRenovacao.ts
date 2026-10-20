"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  buscarLote,
  concluirLote,
  enviarCertificadoUnicoLote,
  enviarComprovanteLote,
  enviarEvidenciaLegalizacao,
  iniciarLote,
  registrarProtocoloLote,
  retirarItemLote,
} from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import type {
  IniciarLotePayload,
  LoteRenovacao,
  ProtocoloLotePayload,
} from "@/types/legalizacao";

// STC-779: renovação em lote (backend STC-778, rotas em lotes-renovacao/).

function chaveDoLote(id: number) {
  return ["lote-renovacao", id] as const;
}

// Uma operação no lote mexe em vários documentos de uma vez (status,
// validade, histórico, evidência, processo): tudo isso na tela é refeito.
const PREFIXOS_AFETADOS = new Set([
  "documentos-legalizacao",
  "documento-legalizacao",
  "processos-renovacao",
  "evidencias-vigentes",
]);

function afetadaPeloLote(chave: unknown) {
  return Array.isArray(chave) && PREFIXOS_AFETADOS.has(chave[0]);
}

export function useLoteRenovacao(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR<LoteRenovacao>(
    id ? chaveDoLote(id) : null,
    () => buscarLote(id as number),
  );
  return {
    lote: data ?? null,
    isLoading,
    mensagemErro: error ? extrairMensagemErro(error) : null,
    mutate,
  };
}

/** As operações do lote, com o estado de "em andamento" de cada uma. Cada
 * uma devolve o lote atualizado (ou null, quando o lote ficou vazio e saiu)
 * e propaga o erro para quem chama mostrar sem perder o que foi preenchido. */
export function useAcoesDoLote() {
  const { mutate } = useSWRConfig();
  const [emAndamento, setEmAndamento] = useState<string | null>(null);

  async function executar<T extends LoteRenovacao | null>(
    nome: string,
    operacao: () => Promise<T>,
  ): Promise<T> {
    setEmAndamento(nome);
    try {
      const lote = await operacao();
      if (lote) await mutate(chaveDoLote(lote.id), lote, { revalidate: false });
      void mutate(afetadaPeloLote);
      return lote;
    } finally {
      setEmAndamento(null);
    }
  }

  return {
    emAndamento,
    iniciar: (payload: IniciarLotePayload) => executar("iniciar", () => iniciarLote(payload)),
    registrarProtocolo: (id: number, payload: ProtocoloLotePayload) =>
      executar("protocolo", () => registrarProtocoloLote(id, payload)),
    enviarComprovante: (id: number, arquivo: File) =>
      executar("comprovante", () => enviarComprovanteLote(id, arquivo)),
    enviarCertificadoUnico: (id: number, arquivo: File) =>
      executar("certificado", () => enviarCertificadoUnicoLote(id, arquivo)),
    // Um PDF por equipamento: a evidência sobe pela rota do próprio documento,
    // que a liga ao processo em curso (o do lote). Depois, o lote é
    // revalidado sem lançar: uma falha só na releitura não é falha do envio
    // (o arquivo já foi gravado), e o SWR tenta de novo.
    enviarCertificadoDoItem: async (id: number, documentoId: number, arquivo: File) => {
      setEmAndamento(`certificado-${documentoId}`);
      try {
        await enviarEvidenciaLegalizacao(documentoId, arquivo);
      } finally {
        setEmAndamento(null);
      }
      void mutate(chaveDoLote(id)).catch(() => {});
      void mutate(afetadaPeloLote);
    },
    concluir: (id: number, itens: { processo: number; nova_validade: string }[]) =>
      executar("concluir", () => concluirLote(id, itens)),
    retirar: async (id: number, processo: number, manterRenovacao: boolean) => {
      const lote = await executar("retirar", () =>
        retirarItemLote(id, processo, manterRenovacao),
      );
      // Lote vazio saiu: tira do cache para a tela não mostrar o antigo.
      if (lote === null) void mutate(chaveDoLote(id), undefined, { revalidate: false });
      return lote;
    },
  };
}
