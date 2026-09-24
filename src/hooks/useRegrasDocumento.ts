"use client";

import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { criarRegraDocumento, listarRegras } from "@/lib/legalizacaoCatalogo";
import { extrairMensagemErro } from "@/lib/erros";
import type { RegraDocumentoPayload } from "@/types/legalizacao";

// STC-527: detecta uma regra já existente (órfã ou não) pra este tipo+
// unidade, pra reaproveitar em vez de tentar criar outra igual e esbarrar na
// UniqueConstraint (tipo_documento, unidade, vigente_a_partir) do backend --
// ver FormCadastrarDocumento.tsx. Desabilitado (chave null) até os dois
// estarem escolhidos, mesmo padrão de useCandidatosResponsaveis
// (useDocumentosLegalizacao.ts).
export function useRegrasDocumento(
  unidadeId: number | undefined,
  tipoDocumentoId: number | undefined,
) {
  const { data, error, isLoading } = useSWR(
    unidadeId && tipoDocumentoId
      ? ["regras-documento-legalizacao-lista", unidadeId, tipoDocumentoId]
      : null,
    () =>
      listarRegras({
        unidade: unidadeId as number,
        tipo_documento: tipoDocumentoId as number,
      }),
  );

  return {
    // Backend já ordena por -vigente_a_partir (RegraDocumento.Meta.ordering)
    // -- a mais recente (a que importa pra reaproveitar) é sempre a 1ª.
    regraMaisRecente: data?.[0] ?? null,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}

// A UI normalmente não lista regras soltas -- a regra atual de um documento
// já vem aninhada em DocumentoUnidade.regra_aplicada, via
// useDocumentosLegalizacao/useDocumentoLegalizacao (useRegrasDocumento acima
// é a exceção, só pra detectar regra órfã antes de criar outra). Sem chave
// de lista pra invalidar aqui: quem invalida é sempre useDocumentosLegalizacao,
// através do onSuccess de
// useCriarDocumentoLegalizacao/useAtualizarDocumentoLegalizacao.
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
