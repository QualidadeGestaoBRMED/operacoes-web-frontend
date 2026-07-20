import { isAxiosError } from "axios";

const MENSAGEM_PADRAO = "Não foi possível completar a operação. Tente novamente.";

/**
 * Normaliza o formato de erro do DRF -- `{"campo": ["msg"]}`,
 * `{"non_field_errors": ["msg"]}` ou `{"detail": "msg"}` -- numa string
 * exibível. Usado pelos hooks de mutação (criar/atualizar/transicionar
 * demanda) pra devolver uma mensagem pronta pra tela.
 */
export function extrairMensagemErro(error: unknown): string {
  if (isAxiosError(error)) {
    const dados: unknown = error.response?.data;

    if (typeof dados === "string" && dados.trim()) {
      return dados;
    }

    if (dados && typeof dados === "object") {
      const mensagens = Object.values(dados)
        .flat()
        .filter((valor): valor is string => typeof valor === "string" && valor.trim() !== "");
      if (mensagens.length > 0) {
        return mensagens.join(" ");
      }
    }

    if (error.message) {
      return error.message;
    }
  }

  return MENSAGEM_PADRAO;
}
