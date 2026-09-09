"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { criarProcessoRenovacao } from "@/lib/legalizacao";
import { extrairMensagemErro } from "@/lib/erros";
import { ehChaveDeListaDeDocumentos } from "./useDocumentosLegalizacao";
import type { ProcessoRenovacaoPayload } from "@/types/legalizacao";

// Só a criação por enquanto (chamada pelo botão "Registrar renovação" do
// Detalhe do Documento, STC-380) -- a tela de acompanhamento do processo já
// criado (Protocolo/Conclusão) é a STC-381, que estende este arquivo.
export function useCriarProcessoRenovacao() {
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    "criar-processo-renovacao",
    (_chave, { arg }: { arg: ProcessoRenovacaoPayload }) =>
      criarProcessoRenovacao(arg),
    // Achado numa análise de falhas críticas (STC-380): sem isto, criar o
    // processo move o documento pra Em andamento (efeito colateral no
    // backend), mas a Matriz por trás do modal continuava mostrando o
    // status antigo até o próximo poll (até 60s) -- mesmo padrão de
    // invalidação já usado por useCriarDocumentoLegalizacao/
    // useAtualizarDocumentoLegalizacao (useDocumentosLegalizacao.ts).
    { onSuccess: () => mutate(ehChaveDeListaDeDocumentos) },
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
