"use client";

import useSWRMutation from "swr/mutation";
import { criarRegraDocumento } from "@/lib/legalizacaoCatalogo";
import { extrairMensagemErro } from "@/lib/erros";
import type { RegraDocumentoPayload } from "@/types/legalizacao";

// Sem hook de listagem própria -- a UI nunca lista regras soltas, só cria (a
// regra atual de um documento já vem aninhada em DocumentoUnidade.regra_aplicada,
// via useDocumentosLegalizacao/useDocumentoLegalizacao). Sem chave de lista
// pra invalidar aqui: quem invalida é sempre useDocumentosLegalizacao, através
// do onSuccess de useCriarDocumentoLegalizacao/useAtualizarDocumentoLegalizacao.
export function useCriarRegraDocumento() {
  const { trigger, isMutating, error } = useSWRMutation(
    "regras-documento-legalizacao",
    (_chave, { arg }: { arg: RegraDocumentoPayload }) =>
      criarRegraDocumento(arg),
  );

  return {
    criar: trigger,
    isLoading: isMutating,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
