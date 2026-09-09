"use client";

import useSWRMutation from "swr/mutation";
import { criarProcessoRenovacao } from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import type { ProcessoRenovacaoPayload } from "@/types/legalizacao";

// Só a criação por enquanto (chamada pelo botão "Registrar renovação" do
// Detalhe do Documento, STC-380) -- a tela de acompanhamento do processo já
// criado (Protocolo/Conclusão) é a STC-381, que estende este arquivo.
export function useCriarProcessoRenovacao() {
  const { trigger, isMutating, error } = useSWRMutation(
    "criar-processo-renovacao",
    (_chave, { arg }: { arg: ProcessoRenovacaoPayload }) =>
      criarProcessoRenovacao(arg),
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
