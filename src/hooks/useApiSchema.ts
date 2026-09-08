"use client";

import useSWR from "swr";
import { buscarSchemaOpenAPI } from "@/lib/openapi";
import { extrairMensagemErro } from "@/lib/erros";

// Sem polling -- diferente das telas de dado operacional (demandas,
// documentos), o schema da API só muda com um deploy do backend, não
// dentro de uma sessão de navegação. Uma busca por carregamento de página
// já satisfaz o princípio da issue ("tempo de request, nunca SSG").
export function useApiSchema() {
  const { data, error, isLoading } = useSWR("api-schema", buscarSchemaOpenAPI);

  return {
    doc: data,
    isLoading,
    error,
    mensagemErro: error ? extrairMensagemErro(error) : null,
  };
}
