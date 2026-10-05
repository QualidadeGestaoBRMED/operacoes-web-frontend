import { isAxiosError } from "axios";

const MENSAGEM_PADRAO = "Não foi possível completar a operação. Tente novamente.";
// Um 401 aqui sempre significa a mesma coisa: o interceptor de api.ts já vai
// chamar signOut() e redirecionar pro login de qualquer forma. Mostrar o
// motivo técnico do SimpleJWT (achado no review: era literalmente os campos
// "detail" + "code" da resposta concatenados, ex. "...tipo de token
// token_not_valid") só confunde numa tela que vai sumir em seguida.
const MENSAGEM_SESSAO_EXPIRADA = "Sua sessão expirou. Você será redirecionado para o login.";
const MENSAGEM_ARQUIVO_GRANDE =
  "Arquivo grande demais para este envio. Tente de novo; se persistir, avise o suporte.";

/**
 * Normaliza o formato de erro do DRF -- `{"campo": ["msg"]}`,
 * `{"non_field_errors": ["msg"]}` ou `{"detail": "msg"}` -- numa string
 * exibível. Usado pelos hooks de mutação (criar/atualizar/transicionar
 * demanda) pra devolver uma mensagem pronta pra tela.
 */
export function extrairMensagemErro(error: unknown): string {
  // Envio direto ao R2 (src/lib/uploadDireto.ts): a mensagem já vem pronta.
  // Pelo nome, sem instanceof, para não importar o módulo de upload aqui.
  if (error instanceof Error && error.name === "ErroEnvioArquivo") {
    return error.message;
  }

  if (isAxiosError(error)) {
    if (error.response?.status === 401) {
      return MENSAGEM_SESSAO_EXPIRADA;
    }

    // 413 vem da função da Vercel (FUNCTION_PAYLOAD_TOO_LARGE), em texto
    // cru, quando um arquivo grande cai no envio multipart pelo proxy BFF.
    if (error.response?.status === 413) {
      return MENSAGEM_ARQUIVO_GRANDE;
    }

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
